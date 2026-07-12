#!/usr/bin/env node
const {EMBEDDING_DIMENSION} = require("./constants");

async function main() {
  require("dotenv").config({path: require("path").resolve(__dirname, "../.env")});

  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME || "kalarang-artworks";

  if (!apiKey) {
    console.error("Set PINECONE_API_KEY in functions/.env");
    process.exit(1);
  }

  console.log(`Creating Pinecone index "${indexName}" (${EMBEDDING_DIMENSION}d, cosine)...`);

  const res = await fetch("https://api.pinecone.io/indexes", {
    method: "POST",
    headers: {
      "Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: indexName,
      dimension: EMBEDDING_DIMENSION,
      metric: "cosine",
      spec: {serverless: {cloud: "aws", region: "us-east-1"}},
    }),
  });

  if (res.ok) {
    const data = await res.json();
    console.log("Index created:", data.host);
    console.log(`\nAdd to functions/.env:\nPINECONE_INDEX_HOST=https://${data.host}`);
  } else {
    const err = await res.text();
    if (err.includes("ALREADY_EXISTS")) {
      console.log("Index already exists.");
    } else {
      console.error("Failed:", res.status, err);
      process.exit(1);
    }
  }
}

main();
