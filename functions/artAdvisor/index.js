const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {defineString} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {getFirestore} = require("firebase-admin/firestore");

const {initOpenAI} = require("./openaiClient");
const {initPinecone} = require("./pineconeClient");
const {
  getOrCreateSession,
  getSessionIfExists,
  checkRateLimits,
  recordNewSession,
  incrementMessageCount,
  saveSession,
} = require("./sessionStore");
const {handleArtAdvisorTurn, hydrateMatchIds, ARTWORK_PAGE_SIZE} = require("./chatOrchestrator");
const {computeProgress} = require("./conversationState");
const {shouldSyncEmbedding, syncArtworkEmbedding, backfillAllArtworks} = require("./artworkEmbedding");

const OPENAI_API_KEY = defineString("OPENAI_API_KEY");
const PINECONE_API_KEY = defineString("PINECONE_API_KEY");
const PINECONE_INDEX_HOST = defineString("PINECONE_INDEX_HOST");

function ensureClients() {
  // OpenAI powers both the chat consultant and artwork embeddings;
  // Pinecone stores the artwork vectors for semantic search.
  const oKey = OPENAI_API_KEY.value() || process.env.OPENAI_API_KEY;
  const pKey = PINECONE_API_KEY.value() || process.env.PINECONE_API_KEY;
  const pHost = PINECONE_INDEX_HOST.value() || process.env.PINECONE_INDEX_HOST;

  if (!oKey) throw new HttpsError("failed-precondition", "OPENAI_API_KEY not configured");
  initOpenAI(oKey);

  if (pKey && pHost) {
    initPinecone(pKey, pHost);
  } else {
    logger.warn("Pinecone not configured — artwork search will use Firestore keyword fallback only. Set PINECONE_API_KEY and PINECONE_INDEX_HOST.");
  }
}

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5000",
  "https://kalarang.art",
  "https://www.kalarang.art",
  "https://kalarang-eff3c.web.app",
  "https://kalarang-eff3c.firebaseapp.com",
  "https://kalarang-dev.web.app",
  "https://kalarang-dev.firebaseapp.com",
];

exports.artAdvisorChat = onCall(
  {
    invoker: "public",
    cors: ALLOWED_ORIGINS,
    memory: "512MiB",
    timeoutSeconds: 120,
    maxInstances: 20,
  },
  async (request) => {
    const {sessionId, message, mode, referenceImageUrls, referenceAttachmentCount} = request.data || {};
    if (!sessionId) {
      throw new HttpsError("invalid-argument", "sessionId is required");
    }

    // Hydrate mode: return stored conversation state without an LLM call,
    // so the UI can restore the conversation after a reload.
    if (mode === "hydrate") {
      const db = getFirestore();
      const existing = await getSessionIfExists(db, sessionId);
      if (!existing) {
        return {messages: [], intent: "general", progress: null};
      }
      const intent = existing.intent && existing.intent !== "unknown" ? existing.intent : "general";
      return {
        messages: (existing.messages || []).map((m) => ({
          role: m.role,
          content: m.content,
          quickReplies: m.quickReplies || [],
          timestamp: m.timestamp,
        })),
        intent,
        progress: computeProgress(intent, existing.commissionDraft || {}, existing.discoveryProfile || {}),
      };
    }

    if (mode === "loadMore") {
      try {
        ensureClients();
      } catch (err) {
        logger.error("Client init failed", {error: err.message});
        throw new HttpsError("internal", "Service configuration error");
      }
      const db = getFirestore();
      const existing = await getSessionIfExists(db, sessionId);
      if (!existing) {
        return {artworkRecommendations: [], hasMoreArtworks: false};
      }
      const pending = existing.discoverContext?.pendingArtworkMatches || [];
      if (pending.length === 0) {
        return {artworkRecommendations: [], hasMoreArtworks: false};
      }
      const nextBatch = pending.slice(0, ARTWORK_PAGE_SIZE);
      const remaining = pending.slice(ARTWORK_PAGE_SIZE);
      const artworks = await hydrateMatchIds(db, nextBatch);
      const sessionRef = db.collection("advisorSessions").doc(sessionId);
      await sessionRef.update({"discoverContext.pendingArtworkMatches": remaining});
      return {
        artworkRecommendations: artworks,
        hasMoreArtworks: remaining.length > 0,
      };
    }

    if (!message?.trim()) {
      throw new HttpsError("invalid-argument", "message is required");
    }

    try {
      ensureClients();
    } catch (err) {
      logger.error("Client init failed", {error: err.message});
      throw new HttpsError("internal", "Service configuration error");
    }

    const db = getFirestore();
    const clientIp = request.rawRequest?.ip || request.rawRequest?.headers?.["x-forwarded-for"] || "";

    let sessionRef, session, isNew;
    try {
      ({ref: sessionRef, session, isNew} = await getOrCreateSession(db, sessionId));
    } catch (err) {
      logger.error("Session init failed", {error: err.message});
      throw new HttpsError("internal", "Could not initialize session");
    }

    const rateLimitMsg = await checkRateLimits(db, session, clientIp, isNew);
    if (rateLimitMsg) {
      throw new HttpsError("resource-exhausted", rateLimitMsg);
    }
    if (isNew) {
      await recordNewSession(db, clientIp);
    }

    try {
      const result = await handleArtAdvisorTurn({
        db,
        session,
        userMessage: message.trim(),
        referenceImageUrls: referenceImageUrls || [],
        referenceAttachmentCount: Number(referenceAttachmentCount) || 0,
      });

      await Promise.all([
        incrementMessageCount(db, sessionRef),
        saveSession(sessionRef, {
          messages: result.messages,
          intent: result.intent,
          commissionDraft: result.commissionDraftState || session.commissionDraft,
          discoveryProfile: result.discoveryProfile || session.discoveryProfile || {},
          discoverContext: {
            ...result.discoverContext,
            pendingArtworkMatches: result.pendingArtworkMatches || [],
          },
        }),
      ]);

      return {
        reply: result.reply,
        quickReplies: result.quickReplies || [],
        intent: result.intent || "general",
        progress: result.progress || null,
        artworkRecommendations: result.artworkRecommendations || [],
        hasMoreArtworks: result.hasMoreArtworks || false,
        totalArtworkMatches: result.totalArtworkMatches || result.artworkRecommendations?.length || 0,
        artistRecommendations: result.artistRecommendations || [],
        commissionPayload: result.commissionPayload || null,
        commissionSummary: result.commissionSummary || null,
        action: result.action || null,
        pendingCommissionField: result.pendingCommissionField || null,
      };
    } catch (err) {
      const status = err?.status;
      const code = err?.code || err?.error?.code;
      logger.error("Chat turn failed", {error: err.message, status, code, type: err?.type, stack: err.stack});
      const msg = err.message || "";
      // No credits / billing not set up. OpenAI returns this as a 429, but it
      // is NOT transient — retrying won't help; an admin must add credits.
      if (code === "insufficient_quota" || msg.includes("insufficient_quota")) {
        throw new HttpsError(
            "failed-precondition",
            "The AI service has no remaining credits. An admin needs to add billing or credits to the OpenAI account.",
        );
      }
      if (status === 429 || msg.includes("429") || msg.includes("rate limit") || msg.includes("quota")) {
        throw new HttpsError("resource-exhausted", "AI service is temporarily busy. Please try again in a moment.");
      }
      if (msg.includes("401") || msg.includes("403") || msg.includes("API key") ||
          msg.includes("leaked") || msg.includes("GEMINI_API_KEY") || msg.includes("OPENAI_API_KEY")) {
        throw new HttpsError(
            "failed-precondition",
            "The AI service API key is invalid or expired. An admin needs to update OPENAI_API_KEY / GEMINI_API_KEY in Firebase Functions.",
        );
      }
      throw new HttpsError("internal", "Something went wrong. Please try again.");
    }
  },
);

exports.syncArtworkEmbeddingOnWrite = onDocumentWritten(
  {
    document: "artworks/{artworkId}",
    region: "us-central1",
    memory: "256MiB",
    maxInstances: 10,
  },
  async (event) => {
    try {
      ensureClients();
    } catch {
      return;
    }

    const beforeData = event.data?.before?.exists ? event.data.before.data() : null;
    const afterData = event.data?.after?.exists ? event.data.after.data() : null;
    const artworkId = event.params.artworkId;

    if (!shouldSyncEmbedding(beforeData, afterData)) return;

    try {
      await syncArtworkEmbedding(artworkId, afterData);
    } catch (err) {
      logger.error("Embedding sync failed", {artworkId, error: err.message});
    }
  },
);

exports.backfillArtworkEmbeddings = onCall(
  {
    invoker: "public",
    cors: ALLOWED_ORIGINS,
    memory: "1GiB",
    timeoutSeconds: 540,
    maxInstances: 1,
  },
  async () => {
    ensureClients();
    const db = getFirestore();
    const result = await backfillAllArtworks(db);
    logger.info("Backfill complete", result);
    return result;
  },
);
