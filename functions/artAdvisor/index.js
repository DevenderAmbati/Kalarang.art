const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {defineString} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {getFirestore} = require("firebase-admin/firestore");

const {initGemini} = require("./geminiClient");
const {initPinecone} = require("./pineconeClient");
const {
  getOrCreateSession,
  getSessionIfExists,
  checkRateLimits,
  incrementMessageCount,
  saveSession,
} = require("./sessionStore");
const {handleArtAdvisorTurn} = require("./chatOrchestrator");
const {computeProgress} = require("./conversationState");
const {shouldSyncEmbedding, syncArtworkEmbedding, backfillAllArtworks} = require("./artworkEmbedding");

const GEMINI_API_KEY = defineString("GEMINI_API_KEY");
const PINECONE_API_KEY = defineString("PINECONE_API_KEY");
const PINECONE_INDEX_HOST = defineString("PINECONE_INDEX_HOST");

function ensureClients() {
  const gKey = GEMINI_API_KEY.value() || process.env.GEMINI_API_KEY;
  const pKey = PINECONE_API_KEY.value() || process.env.PINECONE_API_KEY;
  const pHost = PINECONE_INDEX_HOST.value() || process.env.PINECONE_INDEX_HOST;

  if (!gKey) throw new HttpsError("failed-precondition", "GEMINI_API_KEY not configured");
  initGemini(gKey);

  if (pKey && pHost) {
    initPinecone(pKey, pHost);
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
    const {sessionId, message, mode, referenceImageUrls} = request.data || {};
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

    let sessionRef, session;
    try {
      ({ref: sessionRef, session} = await getOrCreateSession(db, sessionId));
    } catch (err) {
      logger.error("Session init failed", {error: err.message});
      throw new HttpsError("internal", "Could not initialize session");
    }

    const rateLimitMsg = await checkRateLimits(db, session, clientIp);
    if (rateLimitMsg) {
      throw new HttpsError("resource-exhausted", rateLimitMsg);
    }

    try {
      const result = await handleArtAdvisorTurn({
        db,
        session,
        userMessage: message.trim(),
        referenceImageUrls: referenceImageUrls || [],
      });

      await incrementMessageCount(db, sessionRef, clientIp);
      await saveSession(sessionRef, {
        messages: result.messages,
        intent: result.intent,
        commissionDraft: result.commissionDraftState || session.commissionDraft,
        discoveryProfile: result.discoveryProfile || session.discoveryProfile || {},
        discoverContext: result.discoverContext,
      });

      return {
        reply: result.reply,
        quickReplies: result.quickReplies || [],
        intent: result.intent || "general",
        progress: result.progress || null,
        artworkRecommendations: result.artworkRecommendations || [],
        artistRecommendations: result.artistRecommendations || [],
        commissionPayload: result.commissionPayload || null,
        commissionSummary: result.commissionSummary || null,
        action: result.action || null,
        pendingCommissionField: result.pendingCommissionField || null,
      };
    } catch (err) {
      logger.error("Chat turn failed", {error: err.message, stack: err.stack});
      const msg = err.message || "";
      if (msg.includes("429") || msg.includes("quota")) {
        throw new HttpsError("resource-exhausted", "AI service is temporarily busy. Please try again in a moment.");
      }
      if (msg.includes("403") || msg.includes("API key") || msg.includes("leaked") || msg.includes("GEMINI_API_KEY")) {
        throw new HttpsError(
            "failed-precondition",
            "The AI service API key is invalid or expired. An admin needs to update GEMINI_API_KEY in Firebase Functions.",
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
