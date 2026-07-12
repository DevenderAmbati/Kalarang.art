const {SIZE_CATEGORIES} = require("./constants");

function parseInches(val) {
  if (!val) return null;
  const num = parseFloat(String(val));
  return isNaN(num) ? null : num;
}

function parseBudgetRange(budget) {
  if (!budget) return null;
  const cleaned = String(budget).replace(/[₹,\s]/g, "");
  const rangeMatch = cleaned.match(/(\d+)[\-–](\d+)/);
  if (rangeMatch) return {min: Number(rangeMatch[1]), max: Number(rangeMatch[2])};
  const plusMatch = cleaned.match(/(\d+)\+/);
  if (plusMatch) return {min: Number(plusMatch[1]), max: Infinity};
  const num = Number(cleaned);
  if (!isNaN(num) && num > 0) return {min: num * 0.5, max: num * 1.5};
  return null;
}

function matchesArtworkFilters(artwork, filters) {
  if (!filters) return true;

  if (filters.category && artwork.category !== filters.category) return false;

  if (filters.mediums?.length) {
    const m = (artwork.medium || "").toLowerCase();
    if (!filters.mediums.some((fm) => m.includes(fm.toLowerCase()))) return false;
  }

  if (filters.minPrice != null && artwork.price < filters.minPrice) return false;
  if (filters.maxPrice != null && artwork.price > filters.maxPrice) return false;

  if (filters.sizes?.length) {
    const w = parseInches(artwork.width);
    const h = parseInches(artwork.height);
    if (w != null && h != null) {
      const matchesSize = filters.sizes.some((sizeLabel) => {
        const cat = SIZE_CATEGORIES.find((c) => c.label === sizeLabel);
        if (!cat) return false;
        return w >= cat.minWidth && w <= cat.maxWidth && h >= cat.minHeight && h <= cat.maxHeight;
      });
      if (!matchesSize) return false;
    }
  }

  return true;
}

function buildEmbeddingText(artwork) {
  const parts = [
    artwork.title,
    artwork.description,
    artwork.category,
    artwork.medium,
    artwork.artistName,
  ].filter(Boolean);
  return parts.join(" — ");
}

const KEYWORD_STOP_WORDS = new Set([
  "the", "and", "for", "with", "show", "find", "want", "like", "some", "any",
  "art", "artwork", "artworks", "painting", "paintings", "piece", "pieces",
]);

function extractSearchTerms(query) {
  return String(query || "")
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9\u0900-\u097F-]/g, ""))
      .filter((t) => t.length > 2 && !KEYWORD_STOP_WORDS.has(t));
}

function scoreKeywordMatch(haystack, terms) {
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score++;
  }
  return score;
}

/**
 * When the query names a specific subject (e.g. "hanuman"), prefer artworks whose
 * title/description contain those terms. Devotional deity art clusters tightly in
 * embedding space, so without this, Krishna/Ganesha/Radha rank alongside Hanuman.
 */
function applySubjectRelevance(query, items) {
  const terms = extractSearchTerms(query);
  if (terms.length === 0 || items.length === 0) return items;

  const enriched = items.map((item) => {
    const titleHaystack = String(item.title || "").toLowerCase();
    const fullHaystack = String(item.haystack || "").toLowerCase();
    const titleHits = terms.filter((t) => titleHaystack.includes(t)).length;
    const textHits = terms.filter((t) => fullHaystack.includes(t)).length;
    const boostedScore = item.score + titleHits * 0.35 + textHits * 0.15;
    return {...item, titleHits, textHits, score: boostedScore};
  });

  enriched.sort((a, b) => b.score - a.score);

  const hasTitleMatch = enriched.some((i) => i.titleHits > 0);
  if (hasTitleMatch) {
    const titleMatches = enriched.filter((i) => i.titleHits > 0);
    if (titleMatches.length > 0) return titleMatches;
  }

  const hasTextMatch = enriched.some((i) => i.textHits > 0);
  if (hasTextMatch) {
    const textMatches = enriched.filter((i) => i.textHits > 0);
    if (textMatches.length > 0) return textMatches;
  }

  return enriched;
}

function buildArtworkHaystack(data) {
  return [
    data.title,
    data.description,
    data.category,
    data.medium,
    data.artistName,
  ].filter(Boolean).join(" ").toLowerCase();
}

/** Firestore keyword fallback when Pinecone is empty or IDs don't match this project. */
async function searchArtworksByKeywords(db, query, filters, limit = 6) {
  const terms = extractSearchTerms(query);
  if (terms.length === 0) return [];

  const scored = [];
  const batchSize = 200;
  const maxBatches = 5;
  let lastDoc = null;

  for (let batch = 0; batch < maxBatches && scored.length < limit; batch++) {
    let q = db.collection("artworks")
        .where("published", "==", true)
        .orderBy("createdAt", "desc")
        .limit(batchSize);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;
    lastDoc = snap.docs[snap.docs.length - 1];

    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.sold) continue;
      const artwork = {id: doc.id, ...data};
      if (!matchesArtworkFilters(artwork, filters)) continue;

      const haystack = [
        data.title,
        data.description,
        data.category,
        data.medium,
        data.artistName,
      ].filter(Boolean).join(" ").toLowerCase();

      const score = scoreKeywordMatch(haystack, terms);
      if (score > 0) scored.push({doc, score, title: data.title, haystack});
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({doc, score, title, haystack}) => ({doc, score, title, haystack}));
}

module.exports = {
  parseInches,
  parseBudgetRange,
  matchesArtworkFilters,
  buildEmbeddingText,
  extractSearchTerms,
  applySubjectRelevance,
  buildArtworkHaystack,
  searchArtworksByKeywords,
};
