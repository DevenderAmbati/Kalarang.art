/* eslint-disable no-console */
/**
 * Standalone search-stack probe. Run from the functions/ dir:
 *   node artAdvisor/testSearch.js
 * Reads keys from functions/.env. Isolates whether catalog search fails at
 * the Gemini embedding step or the Pinecone query step, and prints the error.
 */
require("dotenv").config();
const {initOpenAI, embedText} = require("./openaiClient");
const {initPinecone, queryArtworks} = require("./pineconeClient");

function report(label, err) {
  console.log(`\n❌ ${label} FAILED`);
  console.log("   message:", err?.message);
}

async function main() {
  const oKey = process.env.OPENAI_API_KEY;
  const pKey = process.env.PINECONE_API_KEY;
  const pHost = process.env.PINECONE_INDEX_HOST;

  console.log("OPENAI_API_KEY present:", Boolean(oKey));
  console.log("PINECONE_API_KEY present:", Boolean(pKey));
  console.log("PINECONE_INDEX_HOST:", pHost || "(missing)");
  if (!oKey || !pKey || !pHost) {
    console.log("\n→ One or more keys are missing from functions/.env. Fix that first.");
    return;
  }

  initOpenAI(oKey);
  initPinecone(pKey, pHost);

  // Step 1 — OpenAI embedding (768 dims to match the Pinecone index).
  let embedding;
  try {
    embedding = await embedText("a calm blue abstract painting for a living room");
    console.log(`\n✅ Step 1 (OpenAI embedText) OK → ${embedding.length} dimensions`);
  } catch (err) {
    report("Step 1 (OpenAI embedText)", err);
    console.log("\n→ Embedding is broken, so indexing won't work either. Stopping.");
    return;
  }

  // Step 2 — Pinecone query with that embedding.
  try {
    const matches = await queryArtworks(embedding, 5);
    console.log(`✅ Step 2 (Pinecone query) OK → ${matches.length} matches returned`);
    if (matches.length === 0) {
      console.log("\n⚠️  Query worked but the index is EMPTY (0 matches).");
      console.log("   → The catalog was never embedded. Run the backfill once to populate Pinecone.");
    } else {
      console.log("   Sample match ids:", matches.slice(0, 3).map((m) => m.artworkId));
      console.log("\n✅ Search stack is healthy.");
    }
  } catch (err) {
    report("Step 2 (Pinecone query)", err);
    console.log("\n→ Common causes: wrong PINECONE_INDEX_HOST, or an index dimension that");
    console.log("  does not match Gemini's 768-dim embeddings.");
  }
}

main().catch((e) => console.error("Unexpected:", e));
