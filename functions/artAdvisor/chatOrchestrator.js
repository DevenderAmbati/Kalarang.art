const {embedText, runChatTurn} = require("./geminiClient");
const {queryArtworks} = require("./pineconeClient");
const {matchesArtworkFilters, parseBudgetRange} = require("./artworkFilters");
const {
  mergeCommissionDraft,
  validateCommissionDraft,
  formatDraftSummary,
  draftToCreatePayload,
} = require("./commissionDraft");
const {SYSTEM_PROMPT} = require("./constants");
const logger = require("firebase-functions/logger");

const TOOL_DECLARATIONS = [
  {
    name: "search_artworks",
    description: "Semantic search for published artworks matching buyer preferences.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {type: "STRING", description: "Natural language search query"},
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
    description: "Merge collected commission request fields into the draft. Call after each user answer.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: {type: "STRING"},
        description: {type: "STRING"},
        budget: {type: "STRING"},
        deadline: {type: "STRING"},
        size: {type: "STRING"},
        customHeight: {type: "STRING"},
        customWidth: {type: "STRING"},
        type: {type: "STRING", description: "Digital, Painting, or Sketch"},
        style: {type: "ARRAY", items: {type: "STRING"}},
        subject: {type: "ARRAY", items: {type: "STRING"}},
        cityOrPincode: {type: "STRING"},
      },
    },
  },
  {
    name: "mark_commission_ready",
    description: "Validate commission draft and signal ready for buyer confirmation.",
    parameters: {type: "OBJECT", properties: {}},
  },
];

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

  let discoverContext = {...(session.discoverContext || {})};
  let artworkResults = [];
  let artistResults = [];
  let commissionAction = null;

  const history = (session.messages || []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const onToolCall = async (name, args) => {
    switch (name) {
    case "search_artworks": {
      const query = String(args.query || userMessage);
      try {
        const embedding = await embedText(query);
        const filter = {
          category: args.category,
          medium: args.medium,
          minPrice: args.minPrice,
          maxPrice: args.maxPrice,
        };
        const matches = await queryArtworks(embedding, 20, filter);

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
          } catch (e) {
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
            note: "Search is temporarily unavailable. Suggest the buyer browse the Discover page.",
          },
        };
      }
      discoverContext = {...discoverContext, lastQuery: query, ...args};
      return {
        response: {
          count: artworkResults.length,
          artworks: artworkResults.map((a) => ({
            id: a.id, title: a.title, price: a.price, category: a.category, medium: a.medium,
          })),
        },
        artworks: artworkResults,
      };
    }
    case "recommend_artists": {
      artistResults = await recommendArtists(db, args.style, args.limit || 5);
      return {response: {artists: artistResults}};
    }
    case "update_commission_draft": {
      commissionDraft = mergeCommissionDraft(commissionDraft, args);
      return {response: {draft: formatDraftSummary(commissionDraft)}, commissionDraft};
    }
    case "mark_commission_ready": {
      const {isValid, errors} = validateCommissionDraft(commissionDraft);
      if (!isValid) return {response: {ready: false, errors}};
      commissionAction = "confirm_commission";
      return {
        response: {ready: true, summary: formatDraftSummary(commissionDraft)},
        action: commissionAction,
        commissionDraft,
      };
    }
    default:
      return {response: {error: "Unknown tool"}};
    }
  };

  const budgetFromContext = discoverContext.budget || commissionDraft.budget;
  const budgetRange = parseBudgetRange(budgetFromContext);
  const enrichedPrompt = budgetRange
    ? `${SYSTEM_PROMPT}\nBuyer budget context: ₹${budgetRange.min}–₹${budgetRange.max}.`
    : SYSTEM_PROMPT;

  const {reply, artworkResults: toolArtworks, commissionAction: action} = await runChatTurn({
    systemPrompt: enrichedPrompt,
    history,
    userMessage,
    tools: TOOL_DECLARATIONS,
    onToolCall,
  });

  if (toolArtworks?.length) artworkResults = toolArtworks;
  if (action) commissionAction = action;

  const intent = commissionAction || commissionDraft.title
    ? "commission"
    : (artworkResults.length ? "discover" : session.intent || "unknown");

  const newMessages = [
    ...(session.messages || []),
    {role: "user", content: userMessage, timestamp: new Date().toISOString()},
    {role: "assistant", content: reply, timestamp: new Date().toISOString()},
  ];

  return {
    reply,
    artworkRecommendations: artworkResults,
    artistRecommendations: artistResults,
    commissionDraft: commissionAction ? commissionDraft : (commissionDraft.title ? commissionDraft : undefined),
    commissionPayload: commissionAction ? draftToCreatePayload(commissionDraft) : undefined,
    commissionSummary: commissionAction ? formatDraftSummary(commissionDraft) : undefined,
    action: commissionAction,
    intent,
    messages: newMessages,
    discoverContext,
    commissionDraftState: commissionDraft,
  };
}

module.exports = {handleArtAdvisorTurn, TOOL_DECLARATIONS};
