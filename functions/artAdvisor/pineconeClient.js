const logger = require("firebase-functions/logger");

let pineconeConfig = null;

function initPinecone(apiKey, indexHost) {
  pineconeConfig = {apiKey, indexHost};
}

async function pineconeRequest(method, path, body) {
  if (!pineconeConfig) throw new Error("Pinecone not initialized");

  const url = `${pineconeConfig.indexHost}${path}`;
  const options = {
    method,
    headers: {
      "Api-Key": pineconeConfig.apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Pinecone ${method} ${path} → ${res.status}: ${errText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function upsertArtworkVector(artworkId, embedding, metadata) {
  await pineconeRequest("POST", "/vectors/upsert", {
    vectors: [{id: artworkId, values: embedding, metadata}],
  });
}

async function deleteArtworkVector(artworkId) {
  await pineconeRequest("POST", "/vectors/delete", {ids: [artworkId]});
}

async function queryArtworks(embedding, topK = 10, filter) {
  const body = {vector: embedding, topK, includeMetadata: true};

  const pineconeFilter = {};
  if (filter?.category) pineconeFilter.category = {$eq: filter.category};
  if (filter?.medium) pineconeFilter.medium = {$eq: filter.medium};
  if (filter?.minPrice || filter?.maxPrice) {
    if (filter.minPrice) pineconeFilter.price = {$gte: filter.minPrice};
    if (filter.maxPrice) {
      pineconeFilter.price = {
        ...(pineconeFilter.price || {}),
        $lte: filter.maxPrice,
      };
    }
  }
  if (Object.keys(pineconeFilter).length > 0) body.filter = pineconeFilter;

  const data = await pineconeRequest("POST", "/query", body);
  return (data.matches || []).map((m) => ({
    artworkId: m.id,
    score: m.score,
    metadata: m.metadata || {},
  }));
}

module.exports = {initPinecone, upsertArtworkVector, deleteArtworkVector, queryArtworks};
