import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ArtworkCard from '../../components/Artwork/ArtworkCard';
import EmptyState from '../../components/State/EmptyState';
import LoadingState from '../../components/State/LoadingState';
import { useFavorites, useLikes } from '../../hooks/useCachedData';
import { 
  saveArtworkToFavorites, 
  removeArtworkFromFavorites,
  likeArtwork,
  unlikeArtwork,
  followArtist,
  unfollowArtist,
} from '../../services/interactionService';
import { Artwork } from '../../types/artwork';
import {
  getArtistArtworks,
} from '../../services/artworkService';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { toast } from 'react-toastify';
import artAnimation from '../../animations/no content.json';
import africanArtAnimation from '../../animations/African American Art.json';
import { cache, cacheKeys } from '../../utils/cache';
import { getActiveStories, getActiveStoriesFromFollowing, Story as StoryType, groupStoriesByUser, GroupedStory, getViewedStories, markStoriesAsViewed, deleteStory, subscribeToActiveStories, subscribeToFollowingStories } from '../../services/storyService';
import { getFollowingArtistIds } from '../../services/userService';
import { getInitialHomeFeedSnapshot, getNextDiscoverPage } from '../../services/homeFeedService';
import { markPostSeen, seedSeenPostIds } from '../../services/postViewService';
import { usePostSeen } from '../../hooks/usePostSeen';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import ArtworkCommentModal from '../../components/Artwork/ArtworkCommentModal';
import ChatDrawer, { ChatContact, ReachOutMetadata } from '../../components/Chat/ChatDrawer';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import './homeFeed.css';
import '../user/Commissions.css';

interface Story {
  id: string;
  image: string;
  name: string;
  userIcon: string;
  price: string;
  artworkId: string;
  artworkTitle: string;
  artistId: string;
}

interface VirtualizedCardItem {
  key: string;
  artwork: Artwork;
  showDiscoverFollow: boolean;
}

const VIRTUAL_BATCH_SIZE = 20;

interface SeenAwareArtworkCardProps {
  artwork: Artwork;
  appUserId?: string;
  saved: Set<string>;
  liked: Set<string>;
  onSeen: (postId: string, immediate?: boolean) => void | Promise<void>;
  onOpen: (artworkId: string) => void;
  onShare: (artworkId: string) => void;
  onSave: (artworkId: string) => void;
  onLike: (artworkId: string) => void;
  onComment: (artwork: Artwork) => void;
  isSeen: boolean;
  showFollowButton?: boolean;
  isFollowingArtist?: boolean;
  onFollowClick?: (artistId: string) => void | Promise<void>;
}

const SeenAwareArtworkCard: React.FC<SeenAwareArtworkCardProps> = ({
  artwork,
  appUserId,
  saved,
  liked,
  onSeen,
  onOpen,
  onShare,
  onSave,
  onLike,
  onComment,
  isSeen,
  showFollowButton = false,
  isFollowingArtist = false,
  onFollowClick,
}) => {
  const { containerRef, markSeenFromInteraction } = usePostSeen({
    postId: artwork.id,
    onSeen: (postId) => onSeen(postId, false),
    isAlreadySeen: isSeen,
  });

  const markAndRun = (fn: () => void) => {
    markSeenFromInteraction();
    onSeen(artwork.id, true);
    fn();
  };

  return (
    <div ref={containerRef}>
      <ArtworkCard
        id={parseInt(artwork.id, 10) || 0}
        artworkImage={artwork.images[0]}
        artworkImages={artwork.images}
        artistAvatar={artwork.artistAvatar || '/artist.png'}
        artistName={artwork.artistName}
        artistId={artwork.artistId}
        currentUserId={appUserId}
        title={artwork.title}
        description={artwork.description}
        onCardClick={() => markAndRun(() => onOpen(artwork.id))}
        onShare={() => onShare(artwork.id)}
        onSave={() => markAndRun(() => onSave(artwork.id))}
        isSaved={saved.has(artwork.id)}
        onLike={() => markAndRun(() => onLike(artwork.id))}
        isLiked={liked.has(artwork.id)}
        onComment={() => markAndRun(() => onComment(artwork))}
        onArtistClick={() => {
          void onSeen(artwork.id, true);
        }}
        showFollowButton={showFollowButton}
        isFollowingArtist={isFollowingArtist}
        onFollowClick={onFollowClick}
      />
    </div>
  );
};

const HomeFeed: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { appUser } = useAuth();
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [currentUserStories, setCurrentUserStories] = useState<Story[]>([]);
  const [viewedStories, setViewedStories] = useState<Set<string>>(new Set());
  const [viewedUsers, setViewedUsers] = useState<Set<string>>(new Set());
  const [currentSessionViewed, setCurrentSessionViewed] = useState<Set<string>>(new Set());
  const [groupedStories, setGroupedStories] = useState<GroupedStory[]>([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    storyId: string;
  }>({
    isOpen: false,
    storyId: '',
  });

  // Reach out → chat drawer state
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [reachOutContact, setReachOutContact] = useState<ChatContact | null>(null);
  const [reachOutMessage, setReachOutMessage] = useState('');
  const [reachOutMetadata, setReachOutMetadata] = useState<ReachOutMetadata | null>(null);
  const [commentArtwork, setCommentArtwork] = useState<Artwork | null>(null);

  // Infinite scroll state
  const [topUnseenArtworks, setTopUnseenArtworks] = useState<Artwork[]>([]);
  const [remainingUnseenArtworks, setRemainingUnseenArtworks] = useState<Artwork[]>([]);
  const [discoverArtworks, setDiscoverArtworks] = useState<Artwork[]>([]);
  const [seenFollowedArtworks, setSeenFollowedArtworks] = useState<Artwork[]>([]);
  const [seenPostIds, setSeenPostIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [followingArtistIds, setFollowingArtistIds] = useState<string[] | null>(null);
  /** Artists followed via discover cards in this session — show "Following" toggle for these only. */
  const [sessionFollowedArtistIds, setSessionFollowedArtistIds] = useState<Set<string>>(new Set());
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  /** Artists only: Following feed vs own published works. */
  const [feedTab, setFeedTab] = useState<'following' | 'my-art'>('following');
  const [myArtworks, setMyArtworks] = useState<Artwork[]>([]);
  const [loadingMyArt, setLoadingMyArt] = useState(false);
  const [virtualSliceEnd, setVirtualSliceEnd] = useState(VIRTUAL_BATCH_SIZE);

  const isArtist = appUser?.role === 'artist';
  const { hidden: tabsHidden, anchorRef: tabsAnchorRef } = useScrollDirection();

  // Use cached data hooks
  const { data: favoriteIds, updateCache: updateFavoritesCache, refetch: refetchFavorites } = useFavorites(appUser?.uid);
  const { data: likeIds, updateCache: updateLikesCache, refetch: refetchLikes } = useLikes(appUser?.uid);

  // Fetch following artist IDs on mount
  useEffect(() => {
    const fetchFollowingArtists = async () => {
      if (appUser?.uid) {
        try {
          const artistIds = await getFollowingArtistIds(appUser.uid);
          setFollowingArtistIds(artistIds);
        } catch (error) {
          setFollowingArtistIds([]);
        }
      } else {
        setFollowingArtistIds([]);
      }
    };

    fetchFollowingArtists();
  }, [appUser?.uid]);

  // Listen for follow/unfollow changes from other components
  useEffect(() => {
    const handleFollowChanged = ((e: CustomEvent) => {
      const detail = e.detail as {
        userId?: string;
        skipHomeFeedReset?: boolean;
      };
      if (detail.userId !== appUser?.uid) return;

      // Follow/unfollow from a discover card: list is already updated locally — do not wipe the feed.
      if (detail.skipHomeFeedReset) {
        if (appUser?.uid) {
          cache.invalidate(cacheKeys.stories(appUser.uid));
        }
        cache.invalidate(cacheKeys.stories());
        if (appUser?.uid) {
          getFollowingArtistIds(appUser.uid)
            .then((ids) => setFollowingArtistIds(ids))
            .catch(() => {});
        }
        return;
      }

      if (appUser?.uid) {
        cache.invalidate(cacheKeys.homeFeedPaginated(appUser.uid));
        cache.invalidate(cacheKeys.stories(appUser.uid));
      }
      cache.invalidate(cacheKeys.homeFeedPaginated());
      cache.invalidate(cacheKeys.stories());

      const refetchFollowing = async () => {
        if (appUser?.uid) {
          try {
            const artistIds = await getFollowingArtistIds(appUser.uid);
            setFollowingArtistIds(artistIds);

            setTopUnseenArtworks([]);
            setRemainingUnseenArtworks([]);
            setDiscoverArtworks([]);
            setLastVisible(null);
            setHasMore(true);
            setSessionFollowedArtistIds(new Set());
            setFeedRefreshKey((prev) => prev + 1);
          } catch (error) {
          }
        }
      };

      refetchFollowing();
    }) as EventListener;
    
    window.addEventListener('follow-changed', handleFollowChanged);
    return () => window.removeEventListener('follow-changed', handleFollowChanged);
  }, [appUser?.uid]);

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
    const handleLikesChanged = ((e: CustomEvent) => {
      if (e.detail.userId === appUser?.uid) {
        refetchLikes();
      }
    }) as EventListener;

    window.addEventListener('likes-changed', handleLikesChanged);
    return () => window.removeEventListener('likes-changed', handleLikesChanged);
  }, [appUser?.uid, refetchLikes]);

  // Ensure favorites are loaded
  useEffect(() => {
    if (appUser?.uid && !favoriteIds) {
      refetchFavorites();
    }
  }, [appUser?.uid, favoriteIds, refetchFavorites]);

  useEffect(() => {
    if (appUser?.uid && !likeIds) {
      refetchLikes();
    }
  }, [appUser?.uid, likeIds, refetchLikes]);

  useEffect(() => {
    let cancelled = false;

    const fetchInitialFeed = async () => {
      setLoading(true);
      try {
        const snapshot = await getInitialHomeFeedSnapshot(appUser?.uid, {
          unseenLimit: 12,
          discoverLimit: 24,
          followedCandidateCap: 140,
        });
        if (cancelled) return;

        setTopUnseenArtworks(snapshot.topUnseen);
        setRemainingUnseenArtworks(snapshot.remainingUnseen);
        setDiscoverArtworks(snapshot.discover);
        setSeenFollowedArtworks(snapshot.seenFollowed);
        setSeenPostIds(snapshot.seenPostIds);
        setLastVisible(snapshot.discoverLastVisible);
        setHasMore(snapshot.hasMoreDiscover);
        if (appUser?.uid) {
          seedSeenPostIds(appUser.uid, snapshot.seenPostIds);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error('Failed to load home feed');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchInitialFeed();
    return () => {
      cancelled = true;
    };
  }, [appUser?.uid, feedRefreshKey]);

  const loadMoreArtworks = useCallback(async () => {
    if (!hasMore || loadingMore || !lastVisible) return;

    setLoadingMore(true);
    try {
      const excluded = new Set<string>([
        ...topUnseenArtworks.map((a) => a.id),
        ...remainingUnseenArtworks.map((a) => a.id),
        ...discoverArtworks.map((a) => a.id),
      ]);
      const next = await getNextDiscoverPage(appUser?.uid, lastVisible, excluded, 20, followingArtistIds ?? []);
      setDiscoverArtworks((prev) => [...prev, ...next.discover]);
      setLastVisible(next.lastVisible);
      setHasMore(next.hasMore);
    } catch (error) {
      toast.error('Failed to load more artworks');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, lastVisible, topUnseenArtworks, remainingUnseenArtworks, discoverArtworks, appUser?.uid, followingArtistIds]);

  // Infinite scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (!hasMore || loadingMore) return;
      if (isArtist && feedTab === 'my-art') return;

      // Get the main content container
      const mainContent = document.querySelector('.layout-main-content');
      if (!mainContent) return;

      const { scrollTop, scrollHeight, clientHeight } = mainContent;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      // Load more when user scrolls to 80% of content
      if (scrollPercentage > 0.8) {
        loadMoreArtworks();
      }
    };

    const mainContent = document.querySelector('.layout-main-content');
    if (mainContent) {
      mainContent.addEventListener('scroll', handleScroll);
      return () => mainContent.removeEventListener('scroll', handleScroll);
    }
  }, [hasMore, loadingMore, loadMoreArtworks, isArtist, feedTab]);

  // Artist "My Art" tab: published pieces with engagement counts
  useEffect(() => {
    if (!isArtist || !appUser?.uid || feedTab !== 'my-art') return;

    let cancelled = false;
    setLoadingMyArt(true);
    getArtistArtworks(appUser.uid, true)
      .then((list) => {
        if (!cancelled) setMyArtworks(list);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load your artworks');
      })
      .finally(() => {
        if (!cancelled) setLoadingMyArt(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isArtist, appUser?.uid, feedTab]);

  // Auto-advance timer for stories (5 seconds per story)
  useEffect(() => {
    if (!selectedStory || isPaused || selectedStory.id === 'default-story') return;

    const timer = setTimeout(() => {
      handleNextStory();
    }, 5000); // 5 seconds per story

    return () => clearTimeout(timer);
  }, [selectedStory, currentStoryIndex, isPaused]);

  // Fetch stories - refetch when component mounts or becomes visible
  // Real-time stories subscription
  useEffect(() => {
    // Wait for followingArtistIds to be loaded if user is logged in
    if (followingArtistIds === null) return;

    setLoadingStories(true);

    let unsubscribe: (() => void) | undefined;

    if (appUser?.uid) {
      // Logged in: subscribe to own stories + following artists' stories
      unsubscribe = subscribeToFollowingStories(
        followingArtistIds,
        appUser.uid,
        (stories) => {
          const grouped = groupStoriesByUser(stories, appUser.uid);
          setGroupedStories(grouped);
          setLoadingStories(false);
        },
        (error) => {
          setLoadingStories(false);
        }
      );
    } else {
      // Not logged in: subscribe to all public stories
      unsubscribe = subscribeToActiveStories(
        (stories) => {
          const grouped = groupStoriesByUser(stories, undefined);
          setGroupedStories(grouped);
          setLoadingStories(false);
        },
        () => {
          setLoadingStories(false);
        }
      );
    }

    // CRITICAL: Cleanup subscription
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [followingArtistIds, appUser?.uid]);

  const fetchStories = async (_forceRefresh = false) => {
    // Real-time updates handle this automatically now
    return;
  };

  const fetchStoriesLegacy = async (forceRefresh = false) => {
    // Keep legacy function for reference but not used
    if (followingArtistIds === null) return;

    setLoadingStories(true);
    try {
      let activeStories: StoryType[] = [];
      if (appUser?.uid) {
        activeStories = await getActiveStoriesFromFollowing(followingArtistIds, appUser.uid);
      } else {
        activeStories = await getActiveStories();
      }
      
      const grouped = groupStoriesByUser(activeStories, appUser?.uid);
      setGroupedStories(grouped);
    } catch {
    } finally {
      setLoadingStories(false);
    }
  };

  // Load viewed stories from database on mount
  useEffect(() => {
    const loadViewedStories = async () => {
      if (appUser?.uid) {
        const viewedIds = await getViewedStories(appUser.uid);
        setViewedStories(new Set(viewedIds));
      }
    };
    
    loadViewedStories();
  }, [appUser?.uid]);

  // Fetch stories when followingArtistIds are loaded
  useEffect(() => {
    if (followingArtistIds !== null) {
      // Clear cache to ensure fresh data
      if (appUser?.uid) {
        cache.invalidate(cacheKeys.stories(appUser.uid));
      } else {
        cache.invalidate(cacheKeys.stories());
      }
      fetchStories();
    }
  }, [followingArtistIds]);

  // Refetch stories when coming from story creation
  useEffect(() => {
    const state = location.state as { storyCreated?: boolean } | null;
    if (state?.storyCreated) {
      fetchStories(true); // Force refresh when story is created
      // Clear the state to prevent refetching on subsequent renders
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Refetch stories when the page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchStories(true); // Force refresh on visibility change
      }
    };

    const handleFocus = () => {
      fetchStories(true); // Force refresh on focus
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [appUser?.uid]);

  // Default story to show when there are no stories
  const defaultStory: Story = {
    id: 'default-story',
    image: '/logo.jpeg',
    name: 'Kalarang',
    userIcon: '/logo.jpeg',
    price: '',
    artworkId: '',
    artworkTitle: 'Welcome to Stories',
    artistId: 'system',
  };

  // Convert favorite IDs array to Set for quick lookup
  const savedArtworks = useMemo(() => {
    return new Set(favoriteIds || []);
  }, [favoriteIds]);

  const likedArtworks = useMemo(() => new Set(likeIds || []), [likeIds]);

  const hasFollowingArtists = (followingArtistIds?.length || 0) > 0;
  const seenPostIdsRef = useRef<Set<string>>(new Set());
  const followingArtistIdsRef = useRef(followingArtistIds);
  const sessionFollowedRef = useRef(sessionFollowedArtistIds);

  useEffect(() => {
    seenPostIdsRef.current = seenPostIds;
  }, [seenPostIds]);
  useEffect(() => { followingArtistIdsRef.current = followingArtistIds; }, [followingArtistIds]);
  useEffect(() => { sessionFollowedRef.current = sessionFollowedArtistIds; }, [sessionFollowedArtistIds]);

  /** Discover-sourced rows get the Follow button; injected unseen-from-following rows do not. */
  const mixedDiscoverRows = useMemo(() => {
    if (!discoverArtworks.length) return [];
    if (!remainingUnseenArtworks.length) {
      return discoverArtworks.map((artwork) => ({
        artwork,
        showDiscoverFollow: true,
      }));
    }

    const mixed: { artwork: Artwork; showDiscoverFollow: boolean }[] = [];
    let unseenIndex = 0;
    let sinceInject = 0;
    const gapPattern = [3, 4];
    let gapCursor = 0;

    discoverArtworks.forEach((artwork) => {
      mixed.push({ artwork, showDiscoverFollow: true });
      sinceInject += 1;

      const targetGap = gapPattern[gapCursor % gapPattern.length];
      if (unseenIndex < remainingUnseenArtworks.length && sinceInject >= targetGap) {
        mixed.push({
          artwork: remainingUnseenArtworks[unseenIndex],
          showDiscoverFollow: false,
        });
        unseenIndex += 1;
        sinceInject = 0;
        gapCursor += 1;
      }
    });

    return mixed;
  }, [discoverArtworks, remainingUnseenArtworks]);

  const homeFeedCards = useMemo<VirtualizedCardItem[]>(() => {
    const list: VirtualizedCardItem[] = [];
    const usedIds = new Set<string>();

    if (hasFollowingArtists) {
      topUnseenArtworks.forEach((artwork, index) => {
        list.push({
          key: `${artwork.id}-top-${index}`,
          artwork,
          showDiscoverFollow: false,
        });
        usedIds.add(artwork.id);
      });
    }

    mixedDiscoverRows.forEach(({ artwork, showDiscoverFollow }, index) => {
      list.push({
        key: `${artwork.id}-mixed-${index}`,
        artwork,
        showDiscoverFollow,
      });
      usedIds.add(artwork.id);
    });

    if (!hasMore && seenFollowedArtworks.length > 0) {
      seenFollowedArtworks.forEach((artwork, index) => {
        if (usedIds.has(artwork.id)) return;
        list.push({
          key: `${artwork.id}-seen-${index}`,
          artwork,
          showDiscoverFollow: false,
        });
      });
    }

    return list;
  }, [hasFollowingArtists, topUnseenArtworks, mixedDiscoverRows, hasMore, seenFollowedArtworks]);

  const visibleHomeFeedCards = useMemo(
    () => homeFeedCards.slice(0, virtualSliceEnd),
    [homeFeedCards, virtualSliceEnd]
  );

  useEffect(() => {
    setVirtualSliceEnd(VIRTUAL_BATCH_SIZE);
  }, [feedRefreshKey]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const scrollRoot =
      (document.querySelector('.layout-main-content') as HTMLElement) || null;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVirtualSliceEnd((prev) => {
            const next = prev + VIRTUAL_BATCH_SIZE;
            return Math.min(next, homeFeedCards.length);
          });
        }
      },
      { root: scrollRoot, rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [homeFeedCards.length]);

  const markSeen = useCallback(async (postId: string, immediate: boolean = false) => {
    if (!appUser?.uid) return;
    const normalizedId = String(postId);
    if (seenPostIdsRef.current.has(normalizedId)) return;

    setSeenPostIds((prev) => {
      if (prev.has(normalizedId)) return prev;
      const next = new Set(prev);
      next.add(normalizedId);
      return next;
    });
    seenPostIdsRef.current.add(normalizedId);

    try {
      await markPostSeen(appUser.uid, normalizedId, { immediate });
    } catch {
      // Keep optimistic local seen state even if network write fails.
    }
  }, [appUser?.uid]);

  const handleDiscoverFollow = useCallback(
    async (artistId: string) => {
      if (!appUser) {
        navigate('/signup');
        return;
      }

      const isCurrentlyFollowing = followingArtistIdsRef.current?.includes(artistId) ?? false;

      try {
        if (isCurrentlyFollowing) {
          await unfollowArtist(appUser.uid, artistId);
          setFollowingArtistIds((prev) => prev ? prev.filter((id) => id !== artistId) : []);
          setSessionFollowedArtistIds((prev) => { const n = new Set(prev); n.delete(artistId); return n; });
        } else {
          await followArtist(appUser.uid, artistId, appUser.name, appUser.avatar);
          setFollowingArtistIds((prev) => { const n = [...(prev ?? [])]; if (!n.includes(artistId)) n.push(artistId); return n; });
          setSessionFollowedArtistIds((prev) => new Set(prev).add(artistId));
        }
      } catch {
        toast.error('Failed to update follow');
      }
    },
    [appUser, navigate]
  );

  // Sort grouped stories Instagram-style: unviewed first, viewed last, current user always first
  const sortedGroupedStories = useMemo(() => {
    if (groupedStories.length === 0) return [];

    // Check if user has any unviewed stories
    const hasUnviewedStories = (group: GroupedStory) => {
      return group.stories.some(story => !viewedStories.has(story.id));
    };

    // Separate current user's stories and others
    const currentUserStories = groupedStories.filter(g => g.artistId === appUser?.uid);
    const otherStories = groupedStories.filter(g => g.artistId !== appUser?.uid);

    // Sort others: unviewed first, then viewed
    const sortedOthers = [...otherStories].sort((a, b) => {
      const aHasUnviewed = hasUnviewedStories(a);
      const bHasUnviewed = hasUnviewedStories(b);
      
      if (aHasUnviewed && !bHasUnviewed) return -1;
      if (!aHasUnviewed && bHasUnviewed) return 1;
      return 0;
    });

    // Current user first, then sorted others
    return [...currentUserStories, ...sortedOthers];
  }, [groupedStories, viewedStories, appUser?.uid]);

  const handleStoryClick = async (artistId: string, userStories: Story[]) => {
    setCurrentUserStories(userStories);
    
    // Find first unviewed story, or start from beginning if all viewed
    const firstUnviewedIndex = userStories.findIndex(story => !viewedStories.has(story.id));
    const startIndex = firstUnviewedIndex !== -1 ? firstUnviewedIndex : 0;
    
    setCurrentStoryIndex(startIndex);
    setSelectedStory(userStories[startIndex]);
    
    // Mark as viewed immediately and save to database
    const storyId = userStories[startIndex].id;
    setCurrentSessionViewed(new Set([storyId]));
    setViewedStories(prev => {
      const newSet = new Set(prev);
      newSet.add(storyId);
      return newSet;
    });
    
    // Save to database immediately
    if (appUser?.uid) {
      await markStoriesAsViewed(appUser.uid, [storyId]);
    }
  };

  const handleCloseStory = async () => {
    // Mark user as viewed if all their stories were seen
    if (selectedStory) {
      setViewedUsers(prev => new Set(prev).add(selectedStory.artistId));
    }
    
    setSelectedStory(null);
    setCurrentUserStories([]);
    setCurrentStoryIndex(0);
    
    // Mark all stories viewed in this session as viewed
    setViewedStories(prev => {
      const newSet = new Set(prev);
      currentSessionViewed.forEach(id => newSet.add(id));
      return newSet;
    });
    
    // Save to database
    if (appUser?.uid && currentSessionViewed.size > 0) {
      await markStoriesAsViewed(appUser.uid, Array.from(currentSessionViewed));
      // Invalidate stories cache after viewing
      cache.invalidate(cacheKeys.stories(appUser.uid));
    }
    
    setCurrentSessionViewed(new Set());
  };

  const handleDeleteStory = () => {
    if (!selectedStory || !appUser?.uid || selectedStory.artistId !== appUser.uid) {
      toast.error('You can only delete your own stories');
      return;
    }

    setIsPaused(true);
    setConfirmModal({
      isOpen: true,
      storyId: selectedStory.id,
    });
  };

  const handleCloseModal = () => {
    setIsPaused(false);
    setConfirmModal({
      isOpen: false,
      storyId: '',
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmModal.storyId || !selectedStory) return;

    try {
      // Delete from Firestore
      await deleteStory(confirmModal.storyId);
      toast.success('✅ Story deleted');
      
      // Invalidate stories cache
      if (appUser?.uid) {
        cache.invalidate(cacheKeys.stories(appUser.uid));
      }
      cache.invalidate(cacheKeys.stories());
      
      // Remove from current user stories
      const updatedStories = currentUserStories.filter(s => s.id !== confirmModal.storyId);
      
      if (updatedStories.length === 0) {
        // No more stories, close modal and refresh
        await handleCloseStory();
        await fetchStories(true); // Force refresh
      } else {
        // Move to next story or previous
        setCurrentUserStories(updatedStories);
        const newIndex = currentStoryIndex >= updatedStories.length 
          ? updatedStories.length - 1 
          : currentStoryIndex;
        setCurrentStoryIndex(newIndex);
        setSelectedStory(updatedStories[newIndex]);
      }
      
      // Refresh stories list with force refresh
      await fetchStories(true);
    } catch {
      toast.error('Failed to delete story');
    }
  };

  // Handle reach out to artist from story — open chat drawer with prefilled message
  const handleReachOut = () => {
    if (!selectedStory || !appUser) {
      navigate('/signup');
      return;
    }

    if (selectedStory.artistId === appUser.uid) {
      toast.info('You cannot reach out to yourself');
      return;
    }

    setIsPaused(true);
    const contact: ChatContact = {
      uid: selectedStory.artistId,
      name: selectedStory.name,
      avatar: selectedStory.userIcon,
    };
    setReachOutContact(contact);
    setReachOutMessage('');
    // Parse price from string to number - strip currency symbol and commas first
    const priceString = selectedStory.price?.replace(/[₹,\s]/g, '') || '';
    const artworkPrice = priceString ? parseFloat(priceString) : undefined;
    setReachOutMetadata({ 
      artworkId: selectedStory.artworkId, 
      artworkTitle: selectedStory.artworkTitle, 
      artworkImage: selectedStory.image,
      artworkPrice: artworkPrice && !isNaN(artworkPrice) ? artworkPrice : undefined
    });
    setChatDrawerOpen(true);
  };

  const handlePreviousStory = async () => {
    if (!selectedStory || currentUserStories.length === 0) return;
    
    if (currentStoryIndex > 0) {
      // Go to previous story of same user
      const newIndex = currentStoryIndex - 1;
      const story = currentUserStories[newIndex];
      setCurrentStoryIndex(newIndex);
      setSelectedStory(story);
      setCurrentSessionViewed(prev => new Set(prev).add(story.id));
      setViewedStories(prev => {
        const newSet = new Set(prev);
        newSet.add(story.id);
        return newSet;
      });
      
      // Save to database immediately
      if (appUser?.uid) {
        await markStoriesAsViewed(appUser.uid, [story.id]);
      }
    } else {
      // Go to previous user's last story
      const currentUserIndex = groupedStories.findIndex(g => g.artistId === selectedStory.artistId);
      if (currentUserIndex > 0) {
        const prevGroup = groupedStories[currentUserIndex - 1];
        const prevUserStories = prevGroup.stories.map(s => ({
          id: s.id,
          image: s.artworkImage,
          name: s.userName,
          userIcon: s.userAvatar,
          price: `₹${s.price.toLocaleString('en-IN')}`,
          artworkId: s.artworkId,
          artworkTitle: s.artworkTitle,
          artistId: s.artistId,
        }));
        setCurrentUserStories(prevUserStories);
        const lastIndex = prevUserStories.length - 1;
        const story = prevUserStories[lastIndex];
        setCurrentStoryIndex(lastIndex);
        setSelectedStory(story);
        setCurrentSessionViewed(prev => new Set(prev).add(story.id));
        setViewedStories(prev => {
          const newSet = new Set(prev);
          newSet.add(story.id);
          return newSet;
        });
        
        // Save to database immediately
        if (appUser?.uid) {
          await markStoriesAsViewed(appUser.uid, [story.id]);
        }
      }
    }
  };

  const handleNextStory = async () => {
    if (!selectedStory || currentUserStories.length === 0) return;
    
    if (currentStoryIndex < currentUserStories.length - 1) {
      // Go to next story of same user
      const newIndex = currentStoryIndex + 1;
      const story = currentUserStories[newIndex];
      setCurrentStoryIndex(newIndex);
      setSelectedStory(story);
      setCurrentSessionViewed(prev => new Set(prev).add(story.id));
      setViewedStories(prev => {
        const newSet = new Set(prev);
        newSet.add(story.id);
        return newSet;
      });
      
      // Save to database immediately
      if (appUser?.uid) {
        await markStoriesAsViewed(appUser.uid, [story.id]);
      }
    } else {
      // Go to next user's first story
      const currentUserIndex = groupedStories.findIndex(g => g.artistId === selectedStory.artistId);
      if (currentUserIndex < groupedStories.length - 1) {
        const nextGroup = groupedStories[currentUserIndex + 1];
        const nextUserStories = nextGroup.stories.map(s => ({
          id: s.id,
          image: s.artworkImage,
          name: s.userName,
          userIcon: s.userAvatar,
          price: `\u20b9${s.price.toLocaleString('en-IN')}`,
          artworkId: s.artworkId,
          artworkTitle: s.artworkTitle,
          artistId: s.artistId,
        }));
        setCurrentUserStories(nextUserStories);
        const story = nextUserStories[0];
        setCurrentStoryIndex(0);
        setSelectedStory(story);
        setCurrentSessionViewed(prev => new Set(prev).add(story.id));
        setViewedStories(prev => {
          const newSet = new Set(prev);
          newSet.add(story.id);
          return newSet;
        });
        
        // Save to database immediately
        if (appUser?.uid) {
          await markStoriesAsViewed(appUser.uid, [story.id]);
        }
      } else {
        // Last story, close
        await handleCloseStory();
      }
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    
    // Pause auto-advance briefly when user taps
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 300);
    
    // Left third of the image
    if (clickX < width / 3) {
      handlePreviousStory();
    }
    // Right third of the image
    else if (clickX > (width * 2) / 3) {
      handleNextStory();
    }
  };

  const handleArtworkClick = (id: number | string) => {
    sessionStorage.setItem('artworkSourceRoute', '/home');
    navigate(`/card/${id}`);
  };

  const updateFeedArtwork = useCallback(
    (artworkId: string, updater: (artwork: Artwork) => Artwork) => {
      const applyUpdate = (list: Artwork[]) =>
        list.map((artwork) =>
          artwork.id === artworkId ? updater(artwork) : artwork
        );

      setTopUnseenArtworks((prev) => applyUpdate(prev));
      setRemainingUnseenArtworks((prev) => applyUpdate(prev));
      setDiscoverArtworks((prev) => applyUpdate(prev));
    },
    []
  );

  const handleShare = (id: number | string) => {
    const sourceList = isArtist && feedTab === 'my-art'
      ? myArtworks
      : [...topUnseenArtworks, ...remainingUnseenArtworks, ...discoverArtworks];
    const artwork = sourceList?.find((a) => a.id === id.toString());
    if (artwork && navigator.share) {
      navigator.share({
        title: artwork.title,
        text: `Check out "${artwork.title}" by ${artwork.artistName}`,
        url: `${window.location.origin}/card/${id}`,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/card/${id}`);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleSave = async (id: number | string) => {
    if (!appUser) {
      navigate('/signup');
      return;
    }

    const artworkId = id.toString();
    const isSaved = savedArtworks.has(artworkId);
    await markSeen(artworkId, true);

    // Optimistic update - update UI immediately
    const previousFavorites = favoriteIds || [];
    updateFavoritesCache((oldFavorites) => {
      const favorites = oldFavorites || [];
      if (isSaved) {
        return favorites.filter(id => id !== artworkId);
      } else {
        return [...favorites, artworkId];
      }
    });

    try {
      if (isSaved) {
        await removeArtworkFromFavorites(appUser.uid, artworkId);
         
      } else {
        await saveArtworkToFavorites(appUser.uid, artworkId, appUser.name, appUser.avatar);
        toast.success('Saved to your favourites');
      }
      // Invalidate favorite artworks cache
      cache.invalidate(cacheKeys.favoriteArtworks(appUser.uid));
      cache.invalidate(cacheKeys.favorites(appUser.uid));
      
      // Broadcast change to other components
      window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { userId: appUser.uid } }));
    } catch {
      // Rollback optimistic update on error
      updateFavoritesCache(() => previousFavorites);
      toast.error('Failed to update favorites');
    }
  };

  const handleLike = async (id: number | string) => {
    if (!appUser) {
      navigate('/signup');
      return;
    }

    const artworkId = id.toString();
    const isLiked = likedArtworks.has(artworkId);
    const previousLikes = likeIds || [];
    await markSeen(artworkId, true);

    updateLikesCache((old) => {
      const list = old || [];
      if (isLiked) {
        return list.filter((lid) => lid !== artworkId);
      }
      return [...list, artworkId];
    });

    updateFeedArtwork(artworkId, (a) => ({
      ...a,
      likes: Math.max(0, (a.likes ?? 0) + (isLiked ? -1 : 1)),
    }));

    try {
      if (isLiked) {
        await unlikeArtwork(appUser.uid, artworkId);
      } else {
        await likeArtwork(appUser.uid, artworkId, appUser.name, appUser.avatar);
      }
      cache.invalidate(cacheKeys.likes(appUser.uid));
      window.dispatchEvent(new CustomEvent('likes-changed', { detail: { userId: appUser.uid } }));
    } catch {
      updateLikesCache(() => previousLikes);
      updateFeedArtwork(artworkId, (a) => ({
        ...a,
        likes: Math.max(0, (a.likes ?? 0) + (isLiked ? 1 : -1)),
      }));
      toast.error('Failed to update like');
    }
  };

  const renderHomeFeedCard = useCallback(
    (item: VirtualizedCardItem) => {
      const { artwork, showDiscoverFollow } = item;
      const isFollowingArtist =
        followingArtistIds?.includes(artwork.artistId) ?? false;
      const wasFollowedThisSession = sessionFollowedArtistIds.has(artwork.artistId);

      const shouldShowFollow = showDiscoverFollow && (!isFollowingArtist || wasFollowedThisSession);

      return (
        <SeenAwareArtworkCard
          key={item.key}
          artwork={artwork}
          appUserId={appUser?.uid}
          saved={savedArtworks}
          liked={likedArtworks}
          isSeen={seenPostIds.has(artwork.id)}
          onSeen={markSeen}
          onOpen={(artworkId) => handleArtworkClick(artworkId)}
          onShare={(artworkId) => handleShare(artworkId)}
          onSave={(artworkId) => {
            void handleSave(artworkId);
          }}
          onLike={(artworkId) => {
            void handleLike(artworkId);
          }}
          onComment={(entry) => setCommentArtwork(entry)}
          showFollowButton={shouldShowFollow}
          isFollowingArtist={isFollowingArtist}
          onFollowClick={handleDiscoverFollow}
        />
      );
    },
    [
      followingArtistIds,
      sessionFollowedArtistIds,
      appUser?.uid,
      savedArtworks,
      likedArtworks,
      seenPostIds,
      markSeen,
      handleDiscoverFollow,
      handleArtworkClick,
      handleShare,
      handleSave,
      handleLike,
    ]
  );

  return (
    <>
      <div style={styles.container} className="home-feed">
        {isArtist && (
          <>
            <div ref={tabsAnchorRef} className={`commission-main-tabs-fixed${tabsHidden ? ' pill-tabs-hidden' : ''}`}>
              <div className="commission-main-tabs">
                <button
                  type="button"
                  className={`commission-tab ${feedTab === 'following' ? 'active' : ''}`}
                  onClick={() => setFeedTab('following')}
                >
                  Following
                </button>
                <button
                  type="button"
                  className={`commission-tab ${feedTab === 'my-art' ? 'active' : ''}`}
                  onClick={() => setFeedTab('my-art')}
                >
                  Creations
                </button>
              </div>
            </div>
            <div className="commission-main-tabs-spacer" />
          </>
        )}

        {/* Stories Section */}
        {(!isArtist || feedTab !== 'my-art') && !loadingStories && (
          <div className="stories-section">
            <div className="stories-container">
              {groupedStories.length === 0 ? (
                // Only show Kalarang story for artists
                appUser?.role === 'artist' ? (
                  <div className="story-item" onClick={() => {
                    const defaultUserStories: Story[] = [{
                      id: 'default-story',
                      image: '/logo.jpeg',
                      name: 'Kalarang',
                      userIcon: '/logo.jpeg',
                      price: '',
                      artworkId: '',
                      artworkTitle: 'Welcome to Stories',
                      artistId: 'system',
                    }];
                    handleStoryClick('system', defaultUserStories);
                  }}>
                    <div className="story-square default-story">
                      <img src="/logo.jpeg" alt="Kalarang" className="story-thumbnail" />
                      <div className="story-user-icon">
                        <img src="/logo.jpeg" alt="Kalarang" className="user-avatar" />
                      </div>
                    </div>
                    <span className="story-name">Kalarang</span>
                  </div>
                ) : null
              ) : (
                sortedGroupedStories.map((group) => {
                  const isOwnStory = group.artistId === appUser?.uid;
                  // Check if user has ANY unviewed stories
                  const hasUnviewed = group.stories.some(story => !viewedStories.has(story.id));
                  
                  // Find first unviewed story for thumbnail, or use first story if all viewed
                  const firstUnviewedStory = group.stories.find(s => !viewedStories.has(s.id)) || group.stories[0];
                  
                  const userStories: Story[] = group.stories.map(s => ({
                    id: s.id,
                    image: s.artworkImage,
                    name: s.userName,
                    userIcon: s.userAvatar,
                    price: `\u20b9${s.price.toLocaleString('en-IN')}`,
                    artworkId: s.artworkId,
                    artworkTitle: s.artworkTitle,
                    artistId: s.artistId,
                  }));
                  
                  return (
                    <div key={group.artistId} className="story-item" onClick={() => handleStoryClick(group.artistId, userStories)}>
                      <div className={`story-square ${!hasUnviewed ? 'viewed' : ''} ${isOwnStory ? 'own-story' : ''}`}>
                        <img src={firstUnviewedStory.artworkImage} alt={group.userName} className="story-thumbnail" />
                        <div className="story-user-icon">
                          <img src={group.userAvatar} alt={group.userName} className="user-avatar" />
                        </div>
                      </div>
                      <span className="story-name">{isOwnStory ? 'Your Story' : group.userName}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Following feed (everyone) or My Art (artists) */}
        {isArtist && feedTab === 'my-art' ? (
          loadingMyArt ? (
            <LoadingState
              animation={africanArtAnimation}
              message="Loading your artworks..."
              fullHeight
            />
          ) : myArtworks.length === 0 ? (
            <EmptyState
              animation={artAnimation}
              title="No published art yet"
              description="Upload your artwork to see it here with likes, comments, and saves."
              actionLabel="Upload artwork"
              actionPath="/upload"
            />
          ) : (
            <div className="homefeed-artwork-grid">
              {myArtworks.map((artwork) => (
                <ArtworkCard
                  key={artwork.id}
                  id={parseInt(artwork.id, 10) || 0}
                  artworkImage={artwork.images[0]}
                  artworkImages={artwork.images}
                  artistAvatar={artwork.artistAvatar || '/artist.png'}
                  artistName={artwork.artistName}
                  artistId={artwork.artistId}
                  currentUserId={appUser?.uid}
                  title={artwork.title}
                  description={artwork.description}
                  onCardClick={() => handleArtworkClick(artwork.id)}
                  onShare={() => handleShare(artwork.id)}
                  onComment={() => setCommentArtwork(artwork)}
                  engagementStats={{
                    likes: artwork.likes ?? 0,
                    comments: artwork.comments ?? 0,
                    favorites: artwork.favorites ?? 0,
                  }}
                />
              ))}
            </div>
          )
        ) : loading ? (
          <LoadingState
            animation={africanArtAnimation}
            message="Discovering amazing artworks..."
            fullHeight
          />
        ) : (
          <>
            {homeFeedCards.length > 0 && (
              <>
                <div className="homefeed-artwork-grid">
                  {visibleHomeFeedCards.map((item) => (
                    <div key={item.key}>{renderHomeFeedCard(item)}</div>
                  ))}
                </div>
                {virtualSliceEnd < homeFeedCards.length && (
                  <div
                    ref={sentinelRef}
                    style={{ height: '1px', width: '100%' }}
                  />
                )}
              </>
            )}
            {loadingMore && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '20px',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    border: '3px solid var(--primary-alpha-20)',
                    borderTop: '3px solid var(--primary)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    animation: 'spin 1s linear infinite',
                  }}
                />
              </div>
            )}
            {!hasMore && homeFeedCards.length > 0 && virtualSliceEnd >= homeFeedCards.length && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '5px',
                  color: 'var(--color-royal)',
                  fontSize: '14px',
                }}
              >
                You've reached the end.
              </div>
            )}
          </>
        )}
      </div>

      {/* Fullscreen Story Modal - Rendered via portal to escape layout stacking context */}
      {selectedStory && ReactDOM.createPortal(
        <div className="story-fullscreen" onClick={handleCloseStory}>
          <div className="story-fullscreen-content" onClick={(e) => e.stopPropagation()}>            {/* Progress bars for multiple stories */}
            {selectedStory.id !== 'default-story' && (
              <div className="story-progress-bars">
                {currentUserStories.map((story, index) => (
                  <div 
                    key={story.id} 
                    className={`story-progress-bar ${
                      index < currentStoryIndex ? 'viewed' : 
                      index === currentStoryIndex ? 'active' : ''
                    }`}
                  >
                    {index === currentStoryIndex && !isPaused && (
                      <div 
                        key={`${story.id}-${currentStoryIndex}`}
                        className="story-progress-fill" 
                        style={{ animation: 'progressFill 5s linear forwards' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
                        <button className="story-close-btn" onClick={handleCloseStory}>
              ✕
            </button>
            {selectedStory.id === 'default-story' ? (
              <div className="default-story-content">
                <div className="default-story-icon">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </div>
                <h2 className="default-story-title">Welcome to Stories!</h2>
                <p className="default-story-text">
                  Stories are a great way to share your artwork with the community for 24 hours.
                </p>
                <div className="default-story-features">
                  <div className="default-story-feature">
                    <span className="feature-emoji">📸</span>
                    <p>Share your artworks as stories</p>
                  </div>
                  <div className="default-story-feature">
                    <span className="feature-emoji">⏰</span>
                    <p>Stories last for 24 hours</p>
                  </div>
                  <div className="default-story-feature">
                    <span className="feature-emoji">👥</span>
                    <p>Follow artists to see their stories</p>
                  </div>
                </div>
                <button className="default-story-btn" onClick={() => { handleCloseStory(); navigate('/discover'); }}>
                  Discover Artists
                </button>
              </div>
            ) : (
              <>
                <div className="story-image-wrapper" onClick={handleImageClick}>
                  <img 
                    src={selectedStory.image} 
                    alt={selectedStory.name} 
                    className="story-fullscreen-image"
                  />
                  {selectedStory.price && <div className="story-price">{selectedStory.price}</div>}
                </div>
                <div className="story-fullscreen-info">
                  <img src={selectedStory.userIcon} alt={selectedStory.name} className="story-fullscreen-avatar" />
                  <span 
                    className="story-fullscreen-name" 
                    onClick={() => { 
                      handleCloseStory(); 
                      const isOwnStory = selectedStory.artistId === appUser?.uid;
                      navigate(isOwnStory ? '/portfolio' : `/portfolio/${selectedStory.artistId}`); 
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {selectedStory.name}
                  </span>
                </div>
                <div className="story-fullscreen-actions">
                  <div className="story-buttons">
                    <button className="story-btn story-btn-primary" onClick={() => { handleCloseStory(); sessionStorage.setItem('artworkSourceRoute', '/home'); navigate(`/card/${selectedStory.artworkId}`); }}>
                      View Details
                    </button>
                    {selectedStory.artistId === appUser?.uid ? (
                      <button className="story-btn story-btn-delete" onClick={handleDeleteStory}>
                        Delete Story
                      </button>
                    ) : (
                      <button className="story-btn story-btn-secondary" onClick={handleReachOut}>
                        Reach Out
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmDelete}
        type="danger"
        title="Delete Story?"
        message="This will permanently delete this story. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />

      <ArtworkCommentModal
        isOpen={commentArtwork !== null}
        onClose={() => setCommentArtwork(null)}
        artwork={commentArtwork}
        appUser={appUser}
      />

      {chatDrawerOpen && reachOutContact && appUser && (
        <ChatDrawer
          isOpen={chatDrawerOpen}
          onClose={() => {
            setChatDrawerOpen(false);
            setReachOutContact(null);
            setReachOutMessage('');
            setReachOutMetadata(null);
            setIsPaused(false);
          }}
          initialContact={reachOutContact}
          initialMessage={reachOutMessage || undefined}
          reachOutMetadata={reachOutMetadata}
        />
      )}
    </>
  );
};

const styles = {
  container: {
    minHeight: '100%',
    padding: '0',
    margin: '0 -0.5rem',
  },
};

export default HomeFeed;
