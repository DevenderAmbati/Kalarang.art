import { UserRole } from '../types/user';

// Define all possible permissions in your app
export enum Permission {
  // Artwork permissions
  CREATE_ARTWORK = 'create_artwork',
  EDIT_OWN_ARTWORK = 'edit_own_artwork',
  DELETE_OWN_ARTWORK = 'delete_own_artwork',
  UPLOAD_IMAGES = 'upload_images',
  
  // Portfolio permissions
  VIEW_PORTFOLIO = 'view_portfolio',
  MANAGE_PORTFOLIO = 'manage_portfolio',
  
  // Profile permissions
  CREATE_USERNAME = 'create_username',
  VIEW_ARTIST_PROFILE = 'view_artist_profile',
  VIEW_BUYER_PROFILE = 'view_buyer_profile',
  
  // Interaction permissions
  LIKE_ARTWORK = 'like_artwork',
  SAVE_FAVORITES = 'save_favorites',
  FOLLOW_ARTISTS = 'follow_artists',
  COMMENT_ARTWORK = 'comment_artwork',
  
  // Browse permissions
  VIEW_FEED = 'view_feed',
  VIEW_DISCOVER = 'view_discover',
  VIEW_ARTWORK_DETAIL = 'view_artwork_detail',
}

// Define permissions for each role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  artist: [
    // Artists can create and manage artwork
    Permission.CREATE_ARTWORK,
    Permission.EDIT_OWN_ARTWORK,
    Permission.DELETE_OWN_ARTWORK,
    Permission.UPLOAD_IMAGES,
    
    // Portfolio management
    Permission.VIEW_PORTFOLIO,
    Permission.MANAGE_PORTFOLIO,
    
    // Profile
    Permission.CREATE_USERNAME,
    Permission.VIEW_ARTIST_PROFILE,
    
    // Interactions
    Permission.LIKE_ARTWORK,
    Permission.SAVE_FAVORITES,
    Permission.FOLLOW_ARTISTS,
    Permission.COMMENT_ARTWORK,
    
    // Browse
    Permission.VIEW_FEED,
    Permission.VIEW_DISCOVER,
    Permission.VIEW_ARTWORK_DETAIL,
  ],
  
  buyer: [
    // Profile
    Permission.VIEW_BUYER_PROFILE,
    
    // Interactions
    Permission.LIKE_ARTWORK,
    Permission.SAVE_FAVORITES,
    Permission.FOLLOW_ARTISTS,
    Permission.COMMENT_ARTWORK,
    
    // Browse
    Permission.VIEW_FEED,
    Permission.VIEW_DISCOVER,
    Permission.VIEW_ARTWORK_DETAIL,
  ],
};

// Define route permissions
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/upload': Permission.CREATE_ARTWORK,
  '/post': Permission.CREATE_ARTWORK,
  '/portfolio': Permission.VIEW_PORTFOLIO,
  '/artist': Permission.VIEW_ARTIST_PROFILE,
  '/buyer': Permission.VIEW_BUYER_PROFILE,
  '/create-username': Permission.CREATE_USERNAME,
  '/home': Permission.VIEW_FEED,
  '/discover': Permission.VIEW_DISCOVER,
  '/favourites': Permission.SAVE_FAVORITES,
  '/profile': Permission.VIEW_BUYER_PROFILE,
};

// Utility function to check if a role has a permission
export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Utility function to check if a role can access a route
export function canAccessRoute(role: UserRole | undefined, route: string): boolean {
  if (!role) return false;
  const requiredPermission = ROUTE_PERMISSIONS[route];
  if (!requiredPermission) return true; // No permission required
  return hasPermission(role, requiredPermission);
}

// Get all accessible routes for a role
export function getAccessibleRoutes(role: UserRole | undefined): string[] {
  if (!role) return [];
  return Object.keys(ROUTE_PERMISSIONS).filter(route => canAccessRoute(role, route));
}
