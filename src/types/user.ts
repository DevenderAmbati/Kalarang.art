export type UserRole = "artist" | "buyer";

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  username?: string; // Optional username field for artists
  avatar?: string; // Profile avatar URL
  bannerImage?: string; // Profile banner URL
  createdAt: Date;
  provider: "password" | "google";
  whatsappNumber?: string; // WhatsApp number for artists
  whatsappVerified?: boolean; // Whether WhatsApp number is verified
  whatsappAddedAt?: Date; // When WhatsApp number was added
  dontAskWhatsApp?: boolean; // User preference to not show WhatsApp prompt
  upiId?: string; // UPI ID for artists (for payment)
  passwordPolicyVersion?: number;
  /** True if user is in the first 100 Founding Artists (set manually in DB). */
  isFoundingArtist?: boolean;
}
