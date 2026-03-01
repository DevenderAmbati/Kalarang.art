import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { saveArtworkToFavorites, removeArtworkFromFavorites, isArtworkInFavorites } from '../../services/interactionService';
import { Artwork } from '../../types/artwork';
import ArtworkGrid from '../../components/Artwork/ArtworkGrid';
import EmptyState from '../../components/State/EmptyState';
import LoadingState from '../../components/State/LoadingState';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { usePublishedWorks, useFavorites, UseCachedDataResult } from '../../hooks/useCachedData';
import { cache, cacheKeys } from '../../utils/cache';
import noContentAnimation from '../../animations/no content.json';
import lineArt2Animation from '../../animations/Line art (2).json';
import './PublishedWorks.css';

interface PublishedWorksProps {
  cachedData?: UseCachedDataResult<Artwork[]>;
  onAddToStory?: (id: string) => void;
  artworkIdsInStories?: Set<string>;
  isOwnProfile?: boolean;
}

const PublishedWorks: React.FC<PublishedWorksProps> = ({ 
  cachedData, 
  onAddToStory, 
  artworkIdsInStories = new Set(),
  isOwnProfile = true 
}) => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  
  // Use provided cached data or fetch if not provided
  const ownData = usePublishedWorks(appUser?.uid, !cachedData);
  const { data: artworks, isLoading, refetch, updateCache } = cachedData || ownData;
  
  const { data: favoriteIds, updateCache: updateFavoritesCache, refetch: refetchFavorites } = useFavorites(appUser?.uid);
  const [savedArtworks, setSavedArtworks] = useState<Set<string>>(new Set());

  // Listen for favorites changes from other components
  useEffect(() => {
    const handleFavoritesChanged = ((e: CustomEvent) => {
      if (e.detail.userId === appUser?.uid) {
        console.log('[PublishedWorks] Favorites changed in another component, refetching...');
        refetchFavorites();
      }
    }) as EventListener;
    
    window.addEventListener('favorites-changed', handleFavoritesChanged);
    return () => window.removeEventListener('favorites-changed', handleFavoritesChanged);
  }, [appUser?.uid, refetchFavorites]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'delete' | 'sold';
    artworkId: string;
  }>({
    isOpen: false,
    type: 'delete',
    artworkId: '',
  });

  useEffect(() => {
    if (favoriteIds) {
      setSavedArtworks(new Set(favoriteIds));
    }
  }, [favoriteIds, appUser]);

  const handleArtworkClick = (id: string) => {
    sessionStorage.setItem('artworkSourceRoute', '/portfolio');
    navigate(`/card/${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`/post?edit=${id}`);
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      artworkId: id,
    });
  };

  const handleMarkAsSold = async (id: string) => {
    if (!appUser) return;

    // Get current sold status
    const currentArtwork = artworks?.find(a => a.id === id);
    const currentSoldStatus = currentArtwork?.sold || false;
    const newSoldStatus = !currentSoldStatus;

    // Optimistic update - toggle sold status immediately
    const previousData = artworks;
    
    updateCache((oldData) => {
      if (!oldData) return oldData;
      return oldData.map(artwork => 
        artwork.id === id 
          ? { ...artwork, sold: newSoldStatus }
          : artwork
      );
    });
    
    toast.success(newSoldStatus ? 'Artwork marked as sold' : 'Sold tag removed');
    
    try {
      const { updateArtwork } = await import('../../services/artworkService');
      await updateArtwork(id, { sold: newSoldStatus });
    } catch (error) {
      // Revert on error
      updateCache(() => previousData);
      console.error('Error updating sold status:', error);
      toast.error('Failed to update sold status. Please try again.');
    }
  };

  const handleSave = async (id: string) => {
    if (!appUser) {
      toast.error('Please log in to save artworks');
      return;
    }

    const isSaved = savedArtworks.has(id);

    // Optimistic update - update UI immediately
    const previousFavorites = favoriteIds || [];
    setSavedArtworks(prev => {
      const newSet = new Set(prev);
      if (isSaved) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
    
    updateFavoritesCache((oldFavorites) => {
      const favorites = oldFavorites || [];
      if (isSaved) {
        return favorites.filter(favId => favId !== id);
      } else {
        return [...favorites, id];
      }
    });

    try {
      if (isSaved) {
        await removeArtworkFromFavorites(appUser.uid, id);
        toast.success('Removed from favorites');
      } else {
        await saveArtworkToFavorites(appUser.uid, id);
        toast.success('Saved to your favourites');
      }
      // Invalidate favorite artworks cache
      cache.invalidate(cacheKeys.favoriteArtworks(appUser.uid));
      cache.invalidate(cacheKeys.favorites(appUser.uid));
      
      // Broadcast change to other components
      window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { userId: appUser.uid } }));
    } catch (error) {
      // Revert on error
      setSavedArtworks(prev => {
        const newSet = new Set(prev);
        if (isSaved) {
          newSet.add(id); // Revert: add back
        } else {
          newSet.delete(id); // Revert: remove
        }
        return newSet;
      });
      updateFavoritesCache(() => previousFavorites);
      console.error('Error toggling save:', error);
      toast.error('Failed to update favorites');
    }
  };

  const handleConfirmAction = async () => {
    const { artworkId, type } = confirmModal;

    if (type === 'delete') {
      // Optimistic update for delete
      const previousData = artworks;
      
      // Update UI immediately
      updateCache((oldData) => {
        if (!oldData) return oldData;
        return oldData.filter(artwork => artwork.id !== artworkId);
      });
      
      handleCloseModal();
      
      try {
        const { deleteArtwork } = await import('../../services/artworkService');
        await deleteArtwork(artworkId);
        
        // Show success toast only after actual deletion succeeds
        toast.success('Artwork deleted successfully');
        
        // Invalidate gallery cache as well since artwork is deleted completely
        if (appUser) {
          console.log('[Cache] Invalidating all portfolio cache after delete');
          cache.invalidate(cacheKeys.galleryWorks(appUser.uid));
          cache.invalidate(cacheKeys.artistWorks(appUser.uid));
        }
      } catch (error) {
        // Revert on error
        updateCache(() => previousData);
        console.error('Error deleting artwork:', error);
        toast.error('Failed to delete artwork. Please try again.');
      }
    }
  };

  const handleCloseModal = () => {
    setConfirmModal({
      isOpen: false,
      type: 'delete',
      artworkId: '',
    });
  };

  if (isLoading) {
    return (
      <div className="published-works-wrapper">
        <div className="published-works-container">
          <LoadingState 
            animation={lineArt2Animation}
            message="Loading your published works..." 
            fullHeight 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="published-works-wrapper">
      <div className="published-works-container">
        <div className="published-works-content">
          {!artworks || artworks.length === 0 ? (
            isOwnProfile ? (
              <EmptyState
                animation={noContentAnimation}
                title="Ready to Publish?"
                description="Your portfolio is waiting for your masterpieces! Upload artwork from the Gallery tab and publish it to share with the world."
                actionLabel="Create Artwork"
                actionPath="/post"
              />
            ) : (
              <EmptyState
                animation={noContentAnimation}
                title="No Published Works"
                description="This artist hasn't published any artworks yet."
              />
            )
          ) : (
            <ArtworkGrid 
              artworks={artworks.map(artwork => ({
                id: artwork.id,
                title: artwork.title,
                artworkImage: artwork.images[0],
                artistName: artwork.artistName,
                artistAvatar: artwork.artistAvatar || '',
                artistId: artwork.artistId,
                price: artwork.price,
                sold: artwork.sold,
              }))}
              viewType="published"
              onArtworkClick={handleArtworkClick}
              isOwner={isOwnProfile}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onMarkAsSold={handleMarkAsSold}
              onSave={handleSave}
              savedArtworks={savedArtworks}
              onAddToStory={onAddToStory}
              artworkIdsInStories={artworkIdsInStories}
              currentUserId={appUser?.uid}
            />
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmAction}
        type={confirmModal.type === 'delete' ? 'danger' : 'warning'}
        title={confirmModal.type === 'delete' ? 'Delete Artwork?' : 'Mark as Sold?'}
        message={
          confirmModal.type === 'delete'
            ? 'This will permanently delete this artwork and all its images from storage. This action cannot be undone.'
            : 'Marking this artwork as sold cannot be undone. The artwork will be labeled as sold everywhere it appears.'
        }
        confirmText={confirmModal.type === 'delete' ? 'Delete' : 'Mark as Sold'}
        cancelText="Cancel"
      />
    </div>
  );
};

export default PublishedWorks;