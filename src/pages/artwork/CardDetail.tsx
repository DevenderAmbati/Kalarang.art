import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ArtworkDetail, { Artwork as ArtworkDetailType, Artist } from '../../components/Artwork/ArtworkDetail';
import LoadingState from '../../components/State/LoadingState';
import ChatDrawer, { ChatContact } from '../../components/Chat/ChatDrawer';
import { useAuth } from '../../context/AuthContext';
import { getArtwork, incrementArtworkViews, incrementArtworkReachOutClicks } from '../../services/artworkService';
import { useFavorites } from '../../hooks/useCachedData';
import { cache, cacheKeys } from '../../utils/cache';
import { 
  saveArtworkToFavorites,
  removeArtworkFromFavorites,
  isArtworkInFavorites,
  followArtist, 
  unfollowArtist, 
  isFollowingArtist
} from '../../services/interactionService';
import { toast } from 'react-toastify';
import lineArt1Animation from '../../animations/Line art (1).json';

const CardDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [artwork, setArtwork] = useState<ArtworkDetailType | null>(null);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [reachOutMessage, setReachOutMessage] = useState<string>('');
  
  const { data: favoriteIds, updateCache: updateFavoritesCache, refetch: refetchFavorites } = useFavorites(appUser?.uid);

  // Listen for favorites changes from other components
  useEffect(() => {
    const handleFavoritesChanged = ((e: CustomEvent) => {
      if (e.detail.userId === appUser?.uid) {
        refetchFavorites();
      }
    }) as EventListener;
    
    window.addEventListener('favorites-changed', handleFavoritesChanged);
    return () => window.removeEventListener('favorites-changed', handleFavoritesChanged);
  }, [appUser?.uid, refetchFavorites]);

  useEffect(() => {
    // Set default source route if none exists (e.g., direct link access)
    if (!sessionStorage.getItem('artworkSourceRoute')) {
      sessionStorage.setItem('artworkSourceRoute', '/home');
    }
    
    if (id) {
      loadArtwork();
    }
  }, [id, appUser]);

  const loadArtwork = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const fetchedArtwork = await getArtwork(id);
      
      if (!fetchedArtwork) {
        toast.error('Artwork not found');
        navigate('/home');
        return;
      }

      // Increment view count (non-blocking)
      try {
        await incrementArtworkViews(id);
      } catch {
        // Don't block artwork display if view count update fails
      }

      // Convert to ArtworkDetailType
      const artworkDetail: ArtworkDetailType = {
        id: parseInt(fetchedArtwork.id) || 0,
        title: fetchedArtwork.title,
        artworkImage: fetchedArtwork.images[0],
        thumbnails: fetchedArtwork.images.slice(1, 5),
        category: fetchedArtwork.category,
        medium: fetchedArtwork.medium,
        size: fetchedArtwork.width && fetchedArtwork.height 
          ? `${fetchedArtwork.width}" × ${fetchedArtwork.height}"`
          : 'Size not specified',
        createdOn: fetchedArtwork.createdDate || fetchedArtwork.createdAt.toLocaleDateString(),
        price: fetchedArtwork.price,
        description: fetchedArtwork.description,
        sold: fetchedArtwork.sold,
      };

      setArtwork(artworkDetail);

      // Set up artist and fetch full profile data
      const artistData: Artist = {
        id: fetchedArtwork.artistId,
        name: fetchedArtwork.artistName,
        avatar: fetchedArtwork.artistAvatar || 'https://i.pravatar.cc/150?img=1',
        isFollowing: false,
      };

      // Check if user is following artist and if artwork is in favorites
      if (appUser && appUser.uid !== fetchedArtwork.artistId) {
        try {
          const following = await isFollowingArtist(appUser.uid, fetchedArtwork.artistId);
          artistData.isFollowing = following;
        } catch (error) {
        }
      }

      // Check if artwork is in favorites (for any logged-in user)
      if (appUser) {
        try {
          const saved = await isArtworkInFavorites(appUser.uid, id);
          setIsSaved(saved);
        } catch (error) {
        }
      }

      setArtist(artistData);
    } catch (error) {
      toast.error('Failed to load artwork');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (artworkId: number) => {
    if (!appUser || !id) {
      navigate('/signup');
      return;
    }

    // Optimistic update - update UI immediately
    const previousFavorites = favoriteIds || [];
    const previousIsSaved = isSaved;
    
    setIsSaved(!isSaved);
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
      } else {
        await saveArtworkToFavorites(appUser.uid, id, appUser.name, appUser.avatar);
        toast.success('Added to favorites');
      }
      // Invalidate favorite artworks cache
      cache.invalidate(cacheKeys.favoriteArtworks(appUser.uid));
      cache.invalidate(cacheKeys.favorites(appUser.uid));
      
      // Broadcast change to other components
      window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { userId: appUser.uid } }));
    } catch (error) {
      // Rollback optimistic update on error
      setIsSaved(previousIsSaved);
      updateFavoritesCache(() => previousFavorites);
      toast.error('Failed to update favorites');
    }
  };

  const handleShare = (artworkId: number) => {
    if (navigator.share && artwork) {
      navigator.share({
        title: artwork.title,
        text: `Check out this artwork: ${artwork.title}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleReachOut = (artistId: string) => {
    if (!appUser) {
      navigate('/signup');
      return;
    }

    if (appUser.uid === artistId) {
      toast.info('You cannot reach out to yourself');
      return;
    }

    if (!artist || !artwork) return;

    // eslint-disable-next-line no-console
    console.log('CardDetail - Opening chat with artworkId:', id, 'title:', artwork.title);

    // Track reach-out intent click without blocking chat open
    if (id) {
      incrementArtworkReachOutClicks(id).catch(() => {});
    }
    
    // Don't set a predefined message, let the user type their own
    setChatDrawerOpen(true);
  };

  const handleFollow = async (artistId: string) => {
    if (!appUser) {
      navigate('/signup');
      return;
    }

    if (!artist) return;

    try {
      if (artist.isFollowing) {
        await unfollowArtist(appUser.uid, artistId);
        setArtist({ ...artist, isFollowing: false });
      } else {
        await followArtist(appUser.uid, artistId, appUser.name, appUser.avatar);
        setArtist({ ...artist, isFollowing: true });
      }
      
      // Broadcast change to other components
      window.dispatchEvent(new CustomEvent('follow-changed', { detail: { userId: appUser.uid } }));
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  };

  const handleThumbnailClick = (_imageUrl: string) => {};

  const handleArtistClick = (artistId: string) => {
    if (!appUser) {
      navigate('/signup');
      return;
    }
    const isOwnProfile = artistId === appUser.uid;
    if (!isOwnProfile) {
      const currentSource = sessionStorage.getItem('artworkSourceRoute');
      if (!currentSource || currentSource.startsWith('/card/')) {
        sessionStorage.setItem('artworkSourceRoute', location.pathname);
      }
    }
    navigate(isOwnProfile ? '/portfolio' : `/portfolio/${artistId}`);
  };

  if (loading || !artwork || !artist) {
    return (
      <LoadingState 
        animation={lineArt1Animation}
        message="Loading artwork details..." 
        fullHeight 
      />
    );
  }

  return (
    <>
      <ArtworkDetail
        artwork={artwork}
        artist={artist}
        currentUserAvatar={appUser?.email ? `https://ui-avatars.com/api/?name=${encodeURIComponent(appUser.name || appUser.email)}` : undefined}
        onShare={handleShare}
        onReachOut={handleReachOut}
        onFollow={handleFollow}
        onThumbnailClick={handleThumbnailClick}
        onArtistClick={handleArtistClick}
        onSave={handleLike}
        isSaved={isSaved}
        currentUserId={appUser?.uid}
      />

      {appUser && artwork && artist && id && (
        <ChatDrawer
          isOpen={chatDrawerOpen}
          onClose={() => {
            setChatDrawerOpen(false);
            setReachOutMessage('');
          }}
          initialContact={{ uid: artist.id, name: artist.name, avatar: artist.avatar } as ChatContact}
          initialMessage={reachOutMessage || undefined}
          reachOutMetadata={{
            artworkId: id,
            artworkTitle: artwork.title,
            artworkImage: artwork.artworkImage,
            artworkPrice: artwork.price
          }}
        />
      )}
    </>
  );
};

export default CardDetail;