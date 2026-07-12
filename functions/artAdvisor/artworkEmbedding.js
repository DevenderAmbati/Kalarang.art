const { embedText } = require("./openaiClient");
const { upsertArtworkVector, deleteArtworkVector } = require("./pineconeClient");
const { buildEmbeddingText } = require("./artworkFilters");
const logger = require("firebase-functions/logger");

function shouldSyncEmbedding(beforeData, afterData) {
  if (!afterData) return false;
  if (!afterData.published) return false;
  if (!beforeData) return true;
  const fields = ["title", "description", "category", "medium", "artistName", "published"];
  return fields.some((f) => JSON.stringify(beforeData[f]) !== JSON.stringify(afterData[f]));
}

async function syncArtworkEmbedding(artworkId, data) {
  if (!data || !data.published) {
    try {
      await deleteArtworkVector(artworkId);
    } catch (e) {
      logger.warn("Delete vector failed (may not exist)", { artworkId });
    }
    return;
  }

  const text = buildEmbeddingText(data);
  if (!text) return;

  const embedding = await embedText(text);
  const metadata = {
    title: data.title || "",
    category: data.category || "",
    medium: data.medium || "",
    price: data.price || 0,
    artistId: data.artistId || "",
    published: data.published,
  };
  await upsertArtworkVector(artworkId, embedding, metadata);
  logger.info("Synced artwork embedding", { artworkId });
}

async function backfillAllArtworks(db) {
  const snap = await db.collection("artworks")
    .where("published", "==", true)
    .get();

  let synced = 0;
  let failed = 0;
  for (const doc of snap.docs) {
    try {
      await syncArtworkEmbedding(doc.id, doc.data());
      synced++;
    } catch (err) {
      logger.error("Backfill failed for artwork", { id: doc.id, error: err.message });
      failed++;
    }
  }
  return { synced, failed, total: snap.size };
}

module.exports = { shouldSyncEmbedding, syncArtworkEmbedding, backfillAllArtworks };
