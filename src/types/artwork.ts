export interface Artwork {
  id: string;
  artistId: string;
  artistName: string;
  artistAvatar?: string;
  title: string;
  description: string;
  images: string[]; // URLs from Firebase Storage
  category: string;
  medium: string;
  width?: string;
  height?: string;
  price: number;
  isCommissioned: boolean;
  published: boolean;
  sold?: boolean;
  createdDate?: string;
  createdAt: Date;
  updatedAt: Date;
  views?: number;
  likes?: number;
}

export interface ArtworkUpload {
  title: string;
  description: string;
  category: string;
  medium: string;
  width?: string;
  height?: string;
  price: number;
  isCommissioned: boolean;
  sold?: boolean;
  createdDate?: string;
}
