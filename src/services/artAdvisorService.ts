import { httpsCallable, FunctionsErrorCode } from "firebase/functions";
import { functions } from "../firebase";
import { CreateCommissionPayload } from "./commissionService";

/** Turn a Firebase callable error into a user-facing message. */
export function getAdvisorErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const code = (err as { code: FunctionsErrorCode }).code;
    const message = String((err as { message: string }).message || "");
    if (code === "functions/failed-precondition" && message.includes("GEMINI_API_KEY")) {
      return "The AI advisor is temporarily unavailable — the API key needs to be updated by an admin.";
    }
    if (code === "functions/resource-exhausted") return message || "You've reached the message limit. Please try again later.";
    if (code === "functions/invalid-argument") return "Something went wrong sending your message. Please refresh and try again.";
    if (message) return message;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

export interface ArtworkRecommendation {
  id: string;
  title: string;
  description?: string;
  images: string[];
  category?: string;
  medium?: string;
  width?: string;
  height?: string;
  price: number;
  artistId?: string;
  artistName?: string;
  artistAvatar?: string;
}

export interface ArtistRecommendation {
  id: string;
  name: string;
  avatar?: string;
  artStyle?: string;
  username?: string;
}

export interface CommissionSummary {
  title: string;
  description: string;
  subject: string;
  size: string;
  medium: string;
  budget: string;
  deadline: string;
  referenceImageCount: number;
  style: string[];
  subjectTags: string[];
  deliveryType: string;
  cityOrPincode: string;
}

export interface PendingCommissionField {
  id: string;
  label: string;
  inputPlaceholder?: string;
}

export type AdvisorIntent =
  | "recommendation"
  | "discovery"
  | "interior_design"
  | "commission"
  | "general";

export type AdvisorStepStatus = "pending" | "filled" | "skipped";

export interface AdvisorProgressStep {
  id: string;
  label: string;
  value: string;
  status: AdvisorStepStatus;
  optional: boolean;
  /** Message sent on the user's behalf when they tap this step to edit it. */
  editPrompt: string;
}

export interface AdvisorProgress {
  intent: AdvisorIntent;
  flowLabel: string;
  steps: AdvisorProgressStep[];
  done: number;
  total: number;
  percent: number;
}

export interface AdvisorChatResponse {
  reply: string;
  quickReplies: string[];
  intent: AdvisorIntent;
  progress: AdvisorProgress | null;
  pendingCommissionField?: PendingCommissionField | null;
  artworkRecommendations: ArtworkRecommendation[];
  hasMoreArtworks?: boolean;
  totalArtworkMatches?: number;
  artistRecommendations: ArtistRecommendation[];
  commissionPayload?: CreateCommissionPayload;
  commissionSummary?: CommissionSummary;
  action?: "confirm_commission" | null;
}

export interface LoadMoreArtworksResponse {
  artworkRecommendations: ArtworkRecommendation[];
  hasMoreArtworks: boolean;
}

export interface AdvisorHydrateResponse {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    quickReplies?: string[];
    timestamp?: string;
  }>;
  intent: AdvisorIntent;
  progress: AdvisorProgress | null;
}

export interface AdvisorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  artworkRecommendations?: ArtworkRecommendation[];
  hasMoreArtworks?: boolean;
  totalArtworkMatches?: number;
  artistRecommendations?: ArtistRecommendation[];
  commissionSummary?: CommissionSummary;
  action?: "confirm_commission" | null;
  quickReplies?: string[];
  timestamp: Date;
}

const SESSION_KEY = "kalarang_advisor_session_id";

export function getOrCreateAdvisorSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function resetAdvisorSessionId(): string {
  const id = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

interface AdvisorRequest {
  sessionId: string;
  message?: string;
  mode?: "hydrate" | "loadMore";
  referenceImageUrls?: string[];
  referenceAttachmentCount?: number;
}

export async function sendAdvisorMessage(
  sessionId: string,
  message: string,
  referenceImageUrls?: string[],
  referenceAttachmentCount?: number,
): Promise<AdvisorChatResponse> {
  const callable = httpsCallable<AdvisorRequest, AdvisorChatResponse>(functions, "artAdvisorChat");
  const result = await callable({
    sessionId,
    message,
    referenceImageUrls,
    referenceAttachmentCount,
  });
  return result.data;
}

export async function loadMoreArtworks(sessionId: string): Promise<LoadMoreArtworksResponse> {
  const callable = httpsCallable<AdvisorRequest, LoadMoreArtworksResponse>(functions, "artAdvisorChat");
  const result = await callable({ sessionId, mode: "loadMore" });
  return result.data;
}

/** Restore a stored conversation (no LLM call) so the UI survives reloads. */
export async function hydrateAdvisorSession(sessionId: string): Promise<AdvisorHydrateResponse> {
  const empty: AdvisorHydrateResponse = { messages: [], intent: "general", progress: null };
  try {
    const callable = httpsCallable<AdvisorRequest, AdvisorHydrateResponse>(functions, "artAdvisorChat");
    const result = await callable({ sessionId, mode: "hydrate" });
    return result.data;
  } catch {
    // Older deployed backends require a message and don't support hydrate mode.
    return empty;
  }
}
