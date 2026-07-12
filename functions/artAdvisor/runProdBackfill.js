/* eslint-disable no-console */
/**
 * Trigger production backfillArtworkEmbeddings (indexes prod Firestore → Pinecone).
 * Run from functions/:  node artAdvisor/runProdBackfill.js
 */
const PROJECT = "kalarang-eff3c";
const URL = `https://us-central1-${PROJECT}.cloudfunctions.net/backfillArtworkEmbeddings`;

async function main() {
  console.log(`Calling ${URL} ...`);
  const res = await fetch(URL, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({data: {}}),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Failed (${res.status}):`, text);
    process.exit(1);
  }
  console.log("Success:", text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
