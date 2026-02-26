import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Artwork } from '../../components/Artwork/ArtworkGrid';
import EmptyState from '../../components/State/EmptyState';
import LoadingState from '../../components/State/LoadingState';
import LazyImage from '../../components/Common/LazyImage';
import { useFavoriteArtworks } from '../../hooks/useCachedData';
import { removeArtworkFromFavorites } from '../../services/interactionService';
import girlAnimation from '../../animations/girl bangs computer.json';
import noContentAnimation from '../../animations/no content.json';
import { toast } from 'react-toastify';
import { cache, cacheKeys } from '../../utils/cache';
import '../feed/Discover.css';

// Custom Artwork Card Component for Favorites with filled hearts by default
interface FavoriteArtworkCardProps {
  artwork: Artwork;
  onArtworkClick: (id: string) => void;
  onRemoveFromFavorites: (id: string) => void;
  isRemoving?: boolean;
  currentUserId?: string;
}

const FavoriteArtworkCard: React.FC<FavoriteArtworkCardProps> = ({ 
  artwork, 
  onArtworkClick, 
  onRemoveFromFavorites,
  isRemoving = false,
  currentUserId
}) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (!isRemoving) {
      onArtworkClick(artwork.id);
    }
  };

  const handleArtistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (artwork.artistId) {
      const isOwnProfile = artwork.artistId === currentUserId;
      if (!isOwnProfile) {
        sessionStorage.setItem('artworkSourceRoute', '/favourites');
      }
      navigate(isOwnProfile ? '/portfolio' : `/portfolio/${artwork.artistId}`);
    }
  };

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isRemoving) {
      onRemoveFromFavorites(artwork.id);
    }
  };

  const formatPrice = (price: number) => {
    return `₹${price.toLocaleString('en-IN')}`;
  };

  return (
    <div 
      className={`artwork-grid-card ${isRemoving ? 'removing' : ''}`}
      onClick={handleCardClick}
      style={isRemoving ? {
        transition: 'all 0.3s ease-out',
        transform: 'scale(0.9)',
        opacity: 0,
      } : {}}
    >
      <div className="artwork-grid-card-image-container">
        <LazyImage src={artwork.artworkImage} alt={artwork.title} className="artwork-grid-card-image" />
        
        {artwork.sold && (
          <div className="artwork-sold-badge">
            <span>SOLD</span>
          </div>
        )}
        
        <div className="artwork-grid-card-overlay">
          <h3 className="artwork-grid-card-title">{artwork.title}</h3>
        </div>
        
        <button
          className={`artwork-grid-card-heart liked ${isRemoving ? 'removing' : ''}`}
          onClick={handleHeartClick}
          aria-label="Remove from favorites"
          style={isRemoving ? {
            transition: 'all 0.2s ease-out',
            transform: 'scale(0.8)',
            opacity: 0.5,
          } : {}}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div className="artwork-grid-card-content">
        <div className="artwork-grid-card-artist">
          <div className="artwork-grid-card-avatar">
            <LazyImage src={artwork.artistAvatar} alt={artwork.artistName} />
          </div>
          <span 
            className="artwork-grid-card-artist-name"
            onClick={handleArtistClick}
            style={{ cursor: artwork.artistId ? 'pointer' : 'default' }}
          >
            {artwork.artistName}
          </span>
          <div className="artwork-grid-card-price">
            {formatPrice(artwork.price)}
          </div>
        </div>
      </div>
    </div>
  );
};

const Favourites: React.FC = () => {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [localArtworks, setLocalArtworks] = useState<Artwork[] | null>(null);

  // Use cached data hook
  const { data: favoriteArtworks, isLoading: loading, refetch } = useFavoriteArtworks(appUser?.uid);
  
  // Sync local artworks with server data
  useEffect(() => {
    if (favoriteArtworks) {
      setLocalArtworks(favoriteArtworks);
    }
  }, [favoriteArtworks]);
  
  // Use local artworks for display (with optimistic updates)
  const displayArtworks = localArtworks || favoriteArtworks;

  // Listen for favorites changes from other components
  useEffect(() => {
    const handleFavoritesChanged = ((e: CustomEvent) => {
      if (e.detail.userId === appUser?.uid) {
        console.log('[Favourites] Favorites changed in another component, refetching...');
        refetch();
      }
    }) as EventListener;
    
    window.addEventListener('favorites-changed', handleFavoritesChanged);
    return () => window.removeEventListener('favorites-changed', handleFavoritesChanged);
  }, [appUser?.uid, refetch]);

  const handleArtworkClick = (id: string) => {
    console.log('Artwork clicked:', id);
    // Navigate to artwork detail page
    sessionStorage.setItem('artworkSourceRoute', '/favourites');
    navigate(`/card/${id}`);
  };

  const handleRemoveFromFavorites = async (id: string) => {
    if (!appUser) return;
    
    // Start the removal animation
    setRemovingIds(prev => new Set(prev).add(id));
    
    try {
      // Optimistically remove from local state immediately
      setLocalArtworks(prev => prev ? prev.filter(artwork => artwork.id !== id) : prev);
      
      // Remove from database
      await removeArtworkFromFavorites(appUser.uid, id);
      
      // Invalidate cache immediately
      cache.invalidate(cacheKeys.favorites(appUser.uid));
      cache.invalidate(cacheKeys.favoriteArtworks(appUser.uid));
      
      // Broadcast change to other components
      window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { userId: appUser.uid } }));
      
      // After animation duration, clean up animation state
      setTimeout(() => {
        setRemovingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        toast.success('Removed from favorites');
      }, 300); // 300ms matches our CSS animation duration
    } catch (error) {
      console.error('Error removing from favorites:', error);
      toast.error('Failed to remove from favorites');
      // Rollback optimistic update on error
      setLocalArtworks(favoriteArtworks);
      // Reset animation state on error
      setRemovingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  return (
    <>
      <style>{`
        @media (min-width: 1025px) {
          .favourites-header {
            margin-bottom: 10px !important;
          }
          .favourites-content {
            margin-top: -10px;
          }
        }
      `}</style>
      <div className="discover-container">
        <div className="discover-header favourites-header">
          <p className="discover-description">
            Your personally curated art collection.
          </p>
        </div>

        {/* Artwork Grid */}
        <div className="discover-content favourites-content">
          {loading && !displayArtworks ? (
            <LoadingState 
              animation={girlAnimation}
              message="Loading your favorites..." 
              fullHeight 
            />
          ) : (displayArtworks && displayArtworks.length > 0) ? (
            <div className="artwork-grid artwork-grid-favourites">
              {displayArtworks.map((artwork) => (
                <FavoriteArtworkCard
                  key={artwork.id}
                  artwork={artwork}
                  onArtworkClick={handleArtworkClick}
                  onRemoveFromFavorites={handleRemoveFromFavorites}
                  isRemoving={removingIds.has(artwork.id)}
                  currentUserId={appUser?.uid}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              animation={noContentAnimation}
              title="Your Favorites Collection Awaits"
              description="Discover amazing artworks and save your favorites here. Start exploring and build your personal art collection!"
              actionLabel="Discover Artworks"
              actionPath="/discover"
            />
          )}
        </div>
      </div>
    </>
  );
};

export default Favourites;
