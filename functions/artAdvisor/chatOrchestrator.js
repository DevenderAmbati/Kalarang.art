const {embedText, runChatTurn} = require("./geminiClient");
const {queryArtworks} = require("./pineconeClient");
const {matchesArtworkFilters, parseBudgetRange} = require("./artworkFilters");
const {
  mergeCommissionDraft,
  validateCommissionDraft,
  formatDraftSummary,
  draftToCreatePayload,
} = require("./commissionDraft");
const {SYSTEM_PROMPT, INTENTS} = require("./constants");
const {buildStateBlock, computeProgress} = require("./conversationState");
const {
  getNextCommissionField,
  getCommissionQuickReplies,
  getCommissionQuestion,
  isCustomChipSelection,
  tryApplyCommissionChip,
  applyCustomAnswerPatch,
  getCustomInputPlaceholder,
} = require("./commissionFields");
const logger = require("firebase-functions/logger");

const TOOL_DECLARATIONS = [
  {
    name: "set_intent",
    description: "Record the user's goal as soon as it is clear, and again whenever it changes.",
    parameters: {
      type: "OBJECT",
      properties: {
        intent: {
          type: "STRING",
          enum: INTENTS,
          description: "recommendation = wants catalog picks; discovery = browsing/exploring; interior_design = art for a room; commission = custom artwork; general = chit-chat or questions only.",
        },
      },
      required: ["intent"],
    },
  },
  {
    name: "update_discovery_profile",
    description: "Save the user's artwork preferences after every answer in discovery, recommendation, or interior-design flows. Use 'No preference' for skipped fields.",
    parameters: {
      type: "OBJECT",
      properties: {
        lookingFor: {type: "STRING", description: "What they want — subject, mood, or style in their own words"},
        room: {type: "STRING", description: "Room or space the art is for"},
        decorStyle: {type: "STRING", description: "Decor style of their space"},
        sizePreference: {type: "STRING", description: "Small, Medium, Large, or No preference"},
        budget: {type: "STRING", description: "Budget range, e.g. '₹2,000–₹5,000' or 'No preference'"},
        colors: {type: "STRING", description: "Color preferences or room palette"},
        styles: {type: "STRING", description: "Art style preferences, comma separated"},
        medium: {type: "STRING", description: "Preferred medium if mentioned"},
        themes: {type: "STRING", description: "Themes or subjects of interest"},
      },
    },
  },
  {
    name: "search_artworks",
    description: "Semantic search of the published artwork catalog. Call when you know enough preferences, or whenever the user asks to see options.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Rich natural-language description of the ideal artwork, combining everything known (subject, mood, room, colors, style)",
        },
        category: {type: "STRING", description: "Artwork category filter"},
        medium: {type: "STRING", description: "Medium filter"},
        minPrice: {type: "NUMBER", description: "Minimum price in INR"},
        maxPrice: {type: "NUMBER", description: "Maximum price in INR"},
        sizes: {
          type: "ARRAY",
          items: {type: "STRING", enum: ["Small", "Medium", "Large"]},
          description: "Size bucket filters",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "recommend_artists",
    description: "Find artists whose style matches buyer preferences.",
    parameters: {
      type: "OBJECT",
      properties: {
        style: {type: "STRING", description: "Preferred art style"},
        limit: {type: "NUMBER", description: "Max artists to return"},
      },
      required: ["style"],
    },
  },
  {
    name: "update_commission_draft",
    description: "Merge collected commission fields into the draft. Call after every commission answer, including edits to earlier answers.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: {type: "STRING"},
        description: {type: "STRING"},
        budget: {type: "STRING"},
        customBudget: {type: "STRING", description: "Exact amount when budget is Custom"},
        deadline: {type: "STRING"},
        size: {type: "STRING"},
        customHeight: {type: "STRING"},
        customWidth: {type: "STRING"},
        type: {type: "STRING", description: "Digital, Painting, or Sketch"},
        style: {type: "ARRAY", items: {type: "STRING"}},
        subject: {type: "ARRAY", items: {type: "STRING"}},
        deliveryType: {type: "STRING", description: "Digital file or Physical artwork"},
        cityOrPincode: {type: "STRING"},
        referenceImagesAnswered: {type: "BOOLEAN"},
        wantsReferenceImages: {type: "BOOLEAN"},
      },
    },
  },
  {
    name: "mark_commission_ready",
    description: "Validate the commission draft and show the confirmation card. Call when every required field is collected, and again after post-summary edits.",
    parameters: {type: "OBJECT", properties: {}},
  },
];

/** Parse the model's JSON reply; degrade gracefully to plain text. */
function parseStructuredReply(raw) {
  const fallback = {message: (raw || "").trim(), quickReplies: []};
  if (!raw) return fallback;

  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return extractListFallback(fallback.message);

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    const message = String(parsed.message || "").trim();
    if (!message) return extractListFallback(fallback.message);
    const quickReplies = Array.isArray(parsed.quickReplies) ?
      parsed.quickReplies
          .map((q) => String(q).trim())
          .filter((q) => q.length > 0 && q.length <= 60)
          .slice(0, 6) :
      [];
    return {message, quickReplies};
  } catch {
    return extractListFallback(fallback.message);
  }
}

/** Legacy safety net: pull numbered/bulleted options out of free text. */
function extractListFallback(text) {
  const quickReplies = [];
  const kept = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.+)$/);
    if (match) {
      const option = match[1].replace(/\*\*/g, "").trim();
      if (option.length > 1 && option.length <= 60) {
        quickReplies.push(option);
        continue;
      }
    }
    kept.push(line);
  }
  if (quickReplies.length >= 2 && quickReplies.length <= 8) {
    return {message: kept.join("\n").trim() || text.trim(), quickReplies};
  }
  return {message: text.trim(), quickReplies: []};
}

async function hydrateArtworks(db, matches) {
  const results = [];
  for (const match of matches.slice(0, 6)) {
    try {
      const snap = await db.collection("artworks").doc(match.artworkId).get();
      if (!snap.exists) continue;
      const data = snap.data();
      if (!data.published || data.sold) continue;
      results.push({
        id: snap.id,
        title: data.title,
        description: data.description,
        images: data.images || [],
        category: data.category,
        medium: data.medium,
        width: data.width,
        height: data.height,
        price: data.price,
        artistId: data.artistId,
        artistName: data.artistName,
        artistAvatar: data.artistAvatar,
        score: match.score,
      });
    } catch (err) {
      logger.warn("Failed to hydrate artwork", {id: match.artworkId, error: err.message});
    }
  }
  return results;
}

async function recommendArtists(db, style, limit = 5) {
  const styleLower = String(style || "").toLowerCase();
  const snap = await db.collection("users")
      .where("role", "==", "artist")
      .limit(100)
      .get();

  const artists = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const artStyle = String(data.artStyle || data.bio || data.name || "").toLowerCase();
    if (styleLower && !artStyle.includes(styleLower)) continue;
    artists.push({
      id: doc.id,
      name: data.name,
      avatar: data.avatar,
      artStyle: data.artStyle,
      username: data.username,
    });
    if (artists.length >= limit) break;
  }
  return artists;
}

async function handleArtAdvisorTurn({db, session, userMessage, referenceImageUrls}) {
  let commissionDraft = {...(session.commissionDraft || {})};
  if (referenceImageUrls?.length) {
    commissionDraft = mergeCommissionDraft(commissionDraft, {referenceImageUrls});
  }

  let discoveryProfile = {...(session.discoveryProfile || {})};
  let discoverContext = {...(session.discoverContext || {})};
  let intent = session.intent && session.intent !== "unknown" ? session.intent : null;
  let artworkResults = [];
  let artistResults = [];
  let commissionAction = null;

  const history = (session.messages || []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const onToolCall = async (name, args) => {
    switch (name) {
      case "set_intent": {
        if (INTENTS.includes(args.intent)) {
          intent = args.intent;
        }
        return {response: {ok: true, intent}};
      }
      case "update_discovery_profile": {
        for (const [key, val] of Object.entries(args || {})) {
          if (typeof val === "string" && val.trim()) {
            discoveryProfile[key] = val.trim();
          }
        }
        return {response: {ok: true, profile: discoveryProfile}};
      }
      case "search_artworks": {
        const query = String(args.query || userMessage);
        try {
          const embedding = await embedText(query);
          const pineconeFilter = {
            category: args.category,
            medium: args.medium,
            minPrice: args.minPrice,
            maxPrice: args.maxPrice,
          };
          const matches = await queryArtworks(embedding, 20, pineconeFilter);

          const filters = {
            category: args.category,
            mediums: args.medium ? [args.medium] : undefined,
            minPrice: args.minPrice,
            maxPrice: args.maxPrice,
            sizes: args.sizes,
          };
          const filteredMatches = [];
          for (const match of matches) {
            try {
              const snap = await db.collection("artworks").doc(match.artworkId).get();
              if (!snap.exists) continue;
              const data = {id: snap.id, ...snap.data()};
              if (matchesArtworkFilters(data, filters)) {
                filteredMatches.push(match);
              }
            } catch {
              continue;
            }
          }
          artworkResults = await hydrateArtworks(db, filteredMatches);
        } catch (searchErr) {
          logger.error("search_artworks failed", {error: searchErr.message});
          return {
            response: {
              count: 0,
              artworks: [],
              note: "Search is temporarily unavailable. Apologize briefly and suggest browsing the Discover page.",
            },
          };
        }
        discoverContext = {
          ...discoverContext,
          lastQuery: query,
          searchCount: (discoverContext.searchCount || 0) + 1,
        };
        return {
          response: {
            count: artworkResults.length,
            artworks: artworkResults.map((a) => ({
              id: a.id, title: a.title, price: a.price, category: a.category, medium: a.medium,
            })),
            note: artworkResults.length ?
              "Cards are shown to the user automatically — do not list artworks in your message." :
              "No matches. Offer to loosen one constraint or suggest commissioning instead.",
          },
        };
      }
      case "recommend_artists": {
        artistResults = await recommendArtists(db, args.style, args.limit || 5);
        return {response: {artists: artistResults}};
      }
      case "update_commission_draft": {
        commissionDraft = mergeCommissionDraft(commissionDraft, args);
        return {response: {ok: true, draft: formatDraftSummary(commissionDraft)}};
      }
      case "mark_commission_ready": {
        const {isValid, errors} = validateCommissionDraft(commissionDraft);
        if (!isValid) {
          return {response: {ready: false, errors, note: "Collect the missing fields before marking ready."}};
        }
        commissionAction = "confirm_commission";
        return {
          response: {
            ready: true,
            note: "Confirmation card is shown to the user — keep your message to one short wrap-up line.",
          },
        };
      }
      default:
        return {response: {error: "Unknown tool"}};
    }
  };

  // Compose the per-turn prompt: persona + rules + authoritative state.
  let systemPrompt = SYSTEM_PROMPT + "\n" + buildStateBlock({
    intent,
    commissionDraft,
    discoveryProfile,
    searchCount: discoverContext.searchCount || 0,
  });
  const budgetRange = parseBudgetRange(discoveryProfile.budget || commissionDraft.budget);
  if (budgetRange) {
    systemPrompt += `\nBuyer budget context: ₹${budgetRange.min}–₹${budgetRange.max === Infinity ? "∞" : budgetRange.max}.`;
  }
  if (referenceImageUrls?.length) {
    systemPrompt += `\nThe user has attached ${referenceImageUrls.length} reference image(s) in the app.`;
  }

  // Auto-apply preset chip answers for commission flow (reliable structured collection).
  if (intent === "commission" || /commission|custom art|custom artwork/i.test(userMessage)) {
    if (!intent) intent = "commission";
    const nextChipField = getNextCommissionField(commissionDraft);
    const isIntentPhrase = /commission|custom art|custom artwork|want to commission/i.test(userMessage);
    const hasCollectedData = Boolean(
        commissionDraft.title || commissionDraft.description || commissionDraft.type ||
        commissionDraft.budget || commissionDraft.deadline,
    );
    if (nextChipField && !isCustomChipSelection(userMessage)) {
      const presetPatch = tryApplyCommissionChip(nextChipField, userMessage);
      if (presetPatch) {
        commissionDraft = mergeCommissionDraft(commissionDraft, presetPatch);
      } else if (hasCollectedData || !isIntentPhrase) {
        const customPatch = applyCustomAnswerPatch(nextChipField, userMessage);
        if (customPatch) commissionDraft = mergeCommissionDraft(commissionDraft, customPatch);
      }
    }
    if (referenceImageUrls?.length) {
      commissionDraft = mergeCommissionDraft(commissionDraft, {
        referenceImagesAnswered: true,
        wantsReferenceImages: true,
      });
    }
  }

  const {reply: rawReply} = await runChatTurn({
    systemPrompt,
    history,
    userMessage,
    tools: TOOL_DECLARATIONS,
    onToolCall,
  });

  const parsed = parseStructuredReply(rawReply);

  // Heuristic fallback if the model never called set_intent.
  if (!intent) {
    if (commissionDraft.title || commissionAction) intent = "commission";
    else if (artworkResults.length || Object.keys(discoveryProfile).length) intent = "discovery";
  }

  let reply = parsed.message;
  let quickReplies = parsed.quickReplies;
  let pendingCommissionField = null;

  // Deterministic commission questions + 3 presets + Custom chips.
  if (intent === "commission" && !commissionAction) {
    if (isCustomChipSelection(userMessage)) {
      const awaiting = getNextCommissionField(commissionDraft);
      if (awaiting) {
        reply = `Sure — type your ${awaiting.label.toLowerCase()}.`;
        quickReplies = [];
        pendingCommissionField = {
          id: awaiting.id,
          label: awaiting.label,
          inputPlaceholder: getCustomInputPlaceholder(awaiting.id),
        };
      }
    } else {
      const nextField = getNextCommissionField(commissionDraft);
      if (nextField) {
        reply = getCommissionQuestion(nextField);
        quickReplies = getCommissionQuickReplies(nextField);
        pendingCommissionField = {
          id: nextField.id,
          label: nextField.label,
          inputPlaceholder: getCustomInputPlaceholder(nextField.id),
        };
      }
    }
  }

  const progress = computeProgress(intent, commissionDraft, discoveryProfile);

  const newMessages = [
    ...(session.messages || []),
    {role: "user", content: userMessage, timestamp: new Date().toISOString()},
    {
      role: "assistant",
      content: reply,
      quickReplies,
      timestamp: new Date().toISOString(),
    },
  ];

  return {
    reply,
    quickReplies,
    pendingCommissionField,
    artworkRecommendations: artworkResults,
    artistRecommendations: artistResults,
    commissionPayload: commissionAction ? draftToCreatePayload(commissionDraft) : undefined,
    commissionSummary: commissionAction ? formatDraftSummary(commissionDraft) : undefined,
    action: commissionAction,
    intent: intent || "general",
    progress,
    messages: newMessages,
    discoverContext,
    discoveryProfile,
    commissionDraftState: commissionDraft,
  };
}

module.exports = {handleArtAdvisorTurn, TOOL_DECLARATIONS, parseStructuredReply};
