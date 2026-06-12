import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { CreateCommissionPayload } from "./commissionService";

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
  subject: string;
  size: string;
  medium: string;
  budget: string;
  deadline: string;
  referenceImageCount: number;
  style: string[];
  cityOrPincode: string;
}

export interface AdvisorChatResponse {
  reply: string;
  artworkRecommendations: ArtworkRecommendation[];
  artistRecommendations: ArtistRecommendation[];
  commissionPayload?: CreateCommissionPayload;
  commissionSummary?: CommissionSummary;
  action?: "confirm_commission" | null;
}

export interface AdvisorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  artworkRecommendations?: ArtworkRecommendation[];
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

export async function sendAdvisorMessage(
  sessionId: string,
  message: string,
  referenceImageUrls?: string[],
): Promise<AdvisorChatResponse> {
  const callable = httpsCallable<
    { sessionId: string; message: string; referenceImageUrls?: string[] },
    AdvisorChatResponse
  >(functions, "artAdvisorChat");

  const result = await callable({ sessionId, message, referenceImageUrls });
  return result.data;
}
