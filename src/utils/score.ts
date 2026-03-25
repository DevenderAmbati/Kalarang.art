/**
 * Artwork ranking score calculation.
 *
 * The score is a weighted combination of recency, engagement, a new-artist
 * boost, and a small random factor.  It is stored on each artwork document
 * and used to order the Explore / Discover feeds.
 */

export interface ScoreableArtwork {
  createdAt: { toMillis?: () => number } | Date | number;
  views?: number;
  favorites?: number;
  reachOutClicks?: number;
  artistTotalArtworks?: number;
}

function toMillis(createdAt: ScoreableArtwork["createdAt"]): number {
  if (typeof createdAt === "number") return createdAt;
  if (createdAt instanceof Date) return createdAt.getTime();
  if (createdAt && typeof (createdAt as any).toMillis === "function") {
    return (createdAt as any).toMillis();
  }
  if (createdAt && typeof (createdAt as any).toDate === "function") {
    return (createdAt as any).toDate().getTime();
  }
  return Date.now();
}

export function calculateScore(artwork: ScoreableArtwork): number {
  const hours = (Date.now() - toMillis(artwork.createdAt)) / (1000 * 60 * 60);

  const recencyScore = Math.exp(-hours / 24);

  const rawEngagement =
    1 * (artwork.views || 0) +
    5 * (artwork.favorites || 0) +
    10 * (artwork.reachOutClicks || 0);

  const engagementScore = Math.min(Math.log(1 + rawEngagement), 3);

  const newArtistBoost =
    artwork.artistTotalArtworks != null && artwork.artistTotalArtworks < 5
      ? 1
      : 0;

  const randomBoost = Math.random();

  const score =
    0.4 * recencyScore +
    0.2 * engagementScore +
    0.1 * newArtistBoost +
    0.1 * randomBoost;

  return parseFloat(score.toFixed(6));
}
