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

module.exports = {parseInches, parseBudgetRange, matchesArtworkFilters, buildEmbeddingText};
