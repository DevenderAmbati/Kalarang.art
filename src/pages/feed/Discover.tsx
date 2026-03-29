import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ArtworkGrid from '../../components/Artwork/ArtworkGrid';
import FilterPanel, { FilterState } from '../../components/Filters/FilterPanel';
import LoadingState from '../../components/State/LoadingState';
import EmptyState from '../../components/State/EmptyState';
import { useFavorites } from '../../hooks/useCachedData';
import { saveArtworkToFavorites, removeArtworkFromFavorites } from '../../services/interactionService';
import { Artwork as ArtworkType } from '../../types/artwork';
import {
  getPublishedArtworksPaginated,
  getPublishedArtworksFilteredPaginated,
  ArtworkFeedSortOption,
  FeedPaginationOrderMode,
} from '../../services/artworkService';
import { searchUsers } from '../../services/userService';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import laptopAnimation from '../../animations/Laptop-Drawing 1.json';
import noContentAnimation from '../../animations/no content.json';
import { toast } from 'react-toastify';
import { cache, cacheKeys } from '../../utils/cache';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import PullToRefreshIndicator from '../../components/Common/PullToRefreshIndicator';
import './Discover.css';

const CATEGORIES = [
  'All',
  'Abstract',
  'Landscape',
  'Portrait',
  'Modern',
  'Craft',
  'Digital',
  'Sculpture',
];

const getGridColumnCount = (width: number): number => {
  if (width >= 1440) return 4;
  if (width >= 1024) return 3;
  return 2;
};

const Discover: React.FC = () => {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const lastScrollY = useRef<number>(0);
  const manuallyToggled = useRef<boolean>(false);
  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(true);
  const [isContainerReady, setIsContainerReady] = useState(false);

  // Handle manual drawer toggle
  const handleDrawerToggle = () => {
    setIsSearchDrawerOpen(!isSearchDrawerOpen);
    // Mark as manually toggled to prevent auto-close
    manuallyToggled.current = true;
    // Reset the flag after 3 seconds to re-enable auto-close
    setTimeout(() => {
      manuallyToggled.current = false;
    }, 3000);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [matchedUsers, setMatchedUsers] = useState<Array<{
    uid: string;
    name: string;
    username?: string;
    avatar?: string;
  }>>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [sortOption, setSortOption] = useState<ArtworkFeedSortOption>('featured');
  const [filters, setFilters] = useState<FilterState>({
    mediums: [],
    priceRange: { min: 100, max: 10000000 },
    sizes: [],
  });

  // Infinite scroll state
  const [artworks, setArtworks] = useState<ArtworkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const artworkGridShellRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const [gridOffsetTop, setGridOffsetTop] = useState(0);
  const [gridScrollTop, setGridScrollTop] = useState(0);
  const [gridViewportHeight, setGridViewportHeight] = useState(0);

  // Use cached data hooks
  const { data: favoriteIds, updateCache: updateFavoritesCache, refetch: refetchFavorites } = useFavorites(appUser?.uid);

  // Set up container ref for pull-to-refresh - find the actual scrollable parent
  useEffect(() => {
    // Find the actual scroll container (parent div with feedScrollContainer style)
    const discoverElement = document.querySelector('.discover-container');
    if (discoverElement) {
      // Walk up to find the scrollable parent
      let parent = discoverElement.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          containerRef.current = parent as HTMLElement;
          setIsContainerReady(true);
          break;
        }
        parent = parent.parentElement;
      }
    }
  }, []);

  // Auto-close drawer on scroll down
  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = containerRef.current;
      if (!scrollContainer) return;

      const currentScrollY = scrollContainer.scrollTop;
      
      // Only auto-close if drawer wasn't manually toggled
      if (!manuallyToggled.current) {
        // Close drawer when scrolling down more than 50px
        if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
          setIsSearchDrawerOpen(prev => {
            // Only close if currently open
            if (prev) {
              return false;
            }
            return prev;
          });
        }
      }
      
      lastScrollY.current = currentScrollY;
    };

    // Wait a bit for containerRef to be set by the other useEffect
    const timeoutId = setTimeout(() => {
      const scrollContainer = containerRef.current;
      if (scrollContainer) {
        // Initialize lastScrollY with current scroll position
        lastScrollY.current = scrollContainer.scrollTop;
        scrollContainer.addEventListener('scroll', handleScroll);
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (containerRef.current) {
        containerRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      debouncedSearchQuery.trim().length > 0 ||
      activeCategory !== 'All' ||
      filters.mediums.length > 0 ||
      filters.sizes.length > 0 ||
      filters.priceRange.min !== 100 ||
      filters.priceRange.max !== 10000000
    );
  }, [debouncedSearchQuery, activeCategory, filters]);

  const needsFilteredQuery = useMemo(() => {
    return (
      hasActiveFilters ||
      sortOption === 'price-low' ||
      sortOption === 'price-high'
    );
  }, [hasActiveFilters, sortOption]);

  const hasActivePanelFilters = useMemo(() => {
    return (
      filters.mediums.length > 0 ||
      filters.sizes.length > 0 ||
      filters.priceRange.min !== 100 ||
      filters.priceRange.max !== 10000000
    );
  }, [filters]);

  const queryOptions = useMemo(() => ({
    query: debouncedSearchQuery.trim(),
    artistIds: matchedUsers.map((u) => u.uid),
    category: activeCategory,
    mediums: filters.mediums,
    priceRange: filters.priceRange,
    sizes: filters.sizes,
    sortOption,
  }), [debouncedSearchQuery, matchedUsers, activeCategory, filters, sortOption]);

  const paginationOrderMode: FeedPaginationOrderMode =
    sortOption === 'newest' ? 'newest' : 'featured';

  const fetchFirstPage = useCallback(async (useFilteredQuery: boolean, forceFresh = false) => {
    if (!useFilteredQuery) {
      const cacheKey = cacheKeys.discoverPaginated(sortOption);
      if (!forceFresh) {
        const cached = cache.get<{
          artworks: ArtworkType[];
          hasMore: boolean;
          lastVisible: QueryDocumentSnapshot<DocumentData> | null;
        }>(cacheKey);

        if (cached.exists && cached.data) {
          setArtworks(cached.data.artworks);
          setHasMore(cached.data.hasMore);
          setLastVisible(cached.data.lastVisible ?? null);
          setLoading(false);
          return;
        }
      }

      const result = await getPublishedArtworksPaginated(20, undefined, paginationOrderMode);
      setArtworks(result.artworks);
      setLastVisible(result.lastVisible);
      setHasMore(result.hasMore);
      cache.set(
        cacheKey,
        { artworks: result.artworks, hasMore: result.hasMore, lastVisible: result.lastVisible },
        2 * 60 * 1000,
        5 * 60 * 1000
      );
      return;
    }

    const result = await getPublishedArtworksFilteredPaginated(queryOptions, 20);
    setArtworks(result.artworks);
    setLastVisible(result.lastVisible);
    setHasMore(result.hasMore);
  }, [queryOptions, sortOption, paginationOrderMode]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    try {
      if (!needsFilteredQuery) {
        cache.invalidate(cacheKeys.discoverPaginated(sortOption));
      }
      await fetchFirstPage(needsFilteredQuery, true);
    } catch (error) {
      throw error;
    }
  }, [fetchFirstPage, needsFilteredQuery, sortOption]);

  // Initialize pull-to-refresh
  const pullToRefreshState = usePullToRefresh(containerRef, {
    onRefresh: handleRefresh,
    isRealtimeActive: false,
    pullThreshold: 80,
    debounceDuration: 300,
    maxPullDistance: 120,
    containerReady: isContainerReady,
  });

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

  // Ensure favorites are loaded
  useEffect(() => {
    if (appUser?.uid && !favoriteIds) {
      refetchFavorites();
    }
  }, [appUser?.uid, favoriteIds, refetchFavorites]);

  // Initial data fetch and refetch when query/filter/sort changes
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        await fetchFirstPage(needsFilteredQuery);
      } catch {
        if (!cancelled) toast.error('Failed to load artworks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [fetchFirstPage, needsFilteredQuery]);

  // Load more artworks
  const loadMoreArtworks = useCallback(async () => {
    if (!hasMore || loadingMore || !lastVisible) return;

    setLoadingMore(true);
    try {
      const result = needsFilteredQuery
        ? await getPublishedArtworksFilteredPaginated(queryOptions, 20, lastVisible)
        : await getPublishedArtworksPaginated(20, lastVisible, paginationOrderMode);
      const existingIds = new Set(artworks.map((a) => a.id));
      const newArtworks = result.artworks.filter((a) => !existingIds.has(a.id));
      const updatedArtworks = [...artworks, ...newArtworks];
      setArtworks(updatedArtworks);
      setLastVisible(result.lastVisible);
      setHasMore(result.hasMore);

      if (!needsFilteredQuery) {
        cache.set(
          cacheKeys.discoverPaginated(sortOption),
          { artworks: updatedArtworks, hasMore: result.hasMore, lastVisible: result.lastVisible },
          2 * 60 * 1000,
          5 * 60 * 1000
        );
      }
    } catch {
      toast.error('Failed to load more artworks');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, lastVisible, artworks, needsFilteredQuery, queryOptions, paginationOrderMode, sortOption]);

  // Infinite scroll detection — use the actual scroll container (parent of discover), not layout-main-content
  useEffect(() => {
    const scrollContainer = containerRef.current;
    if (!scrollContainer || !isContainerReady) return;

    const handleScroll = () => {
      if (!hasMore || loadingMore) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
      if (scrollPercentage > 0.8) {
        loadMoreArtworks();
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, loadMoreArtworks, isContainerReady]);

  // Convert favorite IDs array to Set for quick lookup
  const savedArtworks = useMemo(() => {
    return new Set(favoriteIds || []);
  }, [favoriteIds]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search for users when debounced query changes
  useEffect(() => {
    const performUserSearch = async () => {
      if (debouncedSearchQuery.trim()) {
        try {
          // Extract search terms for better matching
          const query = debouncedSearchQuery.toLowerCase();
          
          // If query is in "Name - @username" format, search only by username
          if (query.includes(' - @')) {
            const parts = query.split(' - @');
            const username = parts[1]; // username without @
            
            // Search only by username
            const users = await searchUsers(username);
            setMatchedUsers(users);
          } else if (query.startsWith('@')) {
            // Searching by @username only
            const username = query.substring(1);
            const users = await searchUsers(username);
            setMatchedUsers(users);
          } else {
            // Regular search - search by name or username
            const users = await searchUsers(debouncedSearchQuery);
            setMatchedUsers(users);
          }
        } catch {
          setMatchedUsers([]);
        }
      } else {
        setMatchedUsers([]);
      }
    };

    performUserSearch();
  }, [debouncedSearchQuery]);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    };

    if (isSortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSortDropdownOpen]);

  // Close search suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSuggestions]);

  const handleArtworkClick = (id: string) => {
    sessionStorage.setItem('artworkSourceRoute', '/discover');
    navigate(`/card/${id}`);
  };

  const handleSave = async (id: string) => {
    if (!appUser) {
      toast.error('Please log in to save artworks');
      return;
    }

    const isSaved = savedArtworks.has(id);

    // Optimistic update - update UI immediately
    const previousFavorites = favoriteIds || [];
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

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    setIsFilterPanelOpen(false);
  };

  const handleCancelFilters = () => {
    setIsFilterPanelOpen(false);
  };

  const handleSortSelect = (option: ArtworkFeedSortOption) => {
    setSortOption(option);
    setIsSortDropdownOpen(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(value.trim().length > 0);
  };

  const handleClearSearch = () => {
    handleSearchChange('');
    setMatchedUsers([]);
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
  };

  const handleUserClick = (userId: string) => {
    sessionStorage.setItem('artworkSourceRoute', '/discover');
    navigate(`/portfolio/${userId}`);
  };

  // Generate search suggestions based on query (memoized)
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || !artworks || artworks.length === 0) return [];

    const query = searchQuery.toLowerCase();
    const suggestions = new Set<string>();

    artworks.forEach(artwork => {
      // Match in title
      if (artwork.title?.toLowerCase().includes(query)) {
        suggestions.add(artwork.title);
      }
      // Match in category
      if (artwork.category?.toLowerCase().includes(query)) {
        suggestions.add(artwork.category);
      }
      // Match in medium
      if (artwork.medium?.toLowerCase().includes(query)) {
        suggestions.add(artwork.medium);
      }
    });

    // Add matched users - show both name and username together
    matchedUsers.forEach(user => {
      if (user.name && user.username) {
        suggestions.add(`${user.name} - @${user.username}`);
      } else if (user.username) {
        suggestions.add(`@${user.username}`);
      } else if (user.name) {
        suggestions.add(user.name);
      }
    });

    return Array.from(suggestions).slice(0, 8);
  }, [searchQuery, artworks, matchedUsers]);

  const displayedArtworks = artworks || [];
  const shouldVirtualizeGrid = displayedArtworks.length > 30;

  const gridColumnCount = useMemo(() => {
    return getGridColumnCount(gridWidth || window.innerWidth);
  }, [gridWidth]);

  const estimatedRowHeight = useMemo(() => {
    if (!gridWidth) return 360;
    const horizontalPadding = 12; // 6px left + 6px right from .artwork-grid
    const gap = gridWidth <= 639 ? 16 : 18;
    const usableWidth = Math.max(220, gridWidth - horizontalPadding);
    const cardWidth =
      (usableWidth - gap * Math.max(0, gridColumnCount - 1)) / gridColumnCount;
    return Math.max(300, Math.ceil(cardWidth * 1.42));
  }, [gridWidth, gridColumnCount]);

  const rowCount = useMemo(
    () => Math.ceil(displayedArtworks.length / gridColumnCount),
    [displayedArtworks.length, gridColumnCount]
  );

  const relativeScrollTop = Math.max(0, gridScrollTop - gridOffsetTop);
  const visibleStartRow = Math.max(
    0,
    Math.floor(relativeScrollTop / estimatedRowHeight) - 2
  );
  const visibleEndRow = Math.min(
    Math.max(0, rowCount - 1),
    Math.ceil(
      (relativeScrollTop + (gridViewportHeight || 900)) / estimatedRowHeight
    ) + 2
  );
  const startIndex = visibleStartRow * gridColumnCount;
  const endIndex = Math.min(
    displayedArtworks.length,
    (visibleEndRow + 1) * gridColumnCount
  );

  const virtualizedArtworks = shouldVirtualizeGrid
    ? displayedArtworks.slice(startIndex, endIndex)
    : displayedArtworks;
  const topSpacerHeight = shouldVirtualizeGrid
    ? visibleStartRow * estimatedRowHeight
    : 0;
  const renderedRows = Math.ceil(virtualizedArtworks.length / gridColumnCount);
  const totalGridHeight = rowCount * estimatedRowHeight;
  const bottomSpacerHeight = shouldVirtualizeGrid
    ? Math.max(0, totalGridHeight - topSpacerHeight - renderedRows * estimatedRowHeight)
    : 0;

  const updateGridMetrics = useCallback(() => {
    const scrollContainer = containerRef.current;
    const shell = artworkGridShellRef.current;
    if (!scrollContainer || !shell) return;

    setGridScrollTop(scrollContainer.scrollTop);
    setGridViewportHeight(scrollContainer.clientHeight);

    const containerRect = scrollContainer.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const offsetTop = shellRect.top - containerRect.top + scrollContainer.scrollTop;
    setGridOffsetTop(offsetTop);
  }, []);

  useEffect(() => {
    if (!shouldVirtualizeGrid) return;
    const shell = artworkGridShellRef.current;
    if (!shell || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setGridWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, [shouldVirtualizeGrid, displayedArtworks.length]);

  useEffect(() => {
    if (!shouldVirtualizeGrid) return;
    let rafId = 0;
    const scrollContainer = containerRef.current;
    if (!scrollContainer) return;

    const scheduleMeasure = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateGridMetrics();
      });
    };

    scheduleMeasure();
    scrollContainer.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      scrollContainer.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [shouldVirtualizeGrid, updateGridMetrics, displayedArtworks.length]);

  return (
    <>
      <div className="discover-container" style={{ position: 'relative' }}>
        {/* Pull-to-Refresh Indicator */}
        <PullToRefreshIndicator
          pullDistance={pullToRefreshState.pullDistance}
          isTriggered={pullToRefreshState.isTriggered}
          isRefreshing={pullToRefreshState.isRefreshing}
          isResetting={pullToRefreshState.isResetting}
          threshold={80}
        />
        
        {/* Sticky Header Section */}
        <div className="discover-sticky-header">
          <div className="discover-header">
            <p className="discover-description">
              Explore curated artwork<span className="discover-description-extended"> from talented artists</span>.
            </p>
            {/* Drawer Toggle Button */}
            <button 
              className={`discover-drawer-toggle ${isSearchDrawerOpen ? 'open' : ''}`}
              onClick={handleDrawerToggle}
              aria-label={isSearchDrawerOpen ? 'Hide search and filters' : 'Show search and filters'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span>{isSearchDrawerOpen ? 'Hide Filters' : 'Search & Filter'}</span>
              <svg className="discover-drawer-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>

          {/* Collapsible Search & Filter Drawer */}
          <div className={`discover-search-drawer ${isSearchDrawerOpen ? 'open' : ''}`}>
            <div className="discover-search-drawer-content">
            {/* Search Bar */}
            <div className="discover-search-container">
            <div className="discover-search-bar" ref={searchContainerRef}>
            <div className="discover-search-field">
              <svg className="discover-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                className="discover-search-input"
                placeholder="Search by style, category, medium, artist"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
                ref={searchInputRef}
              />

              {searchQuery.trim().length > 0 && (
                <button
                  type="button"
                  className="discover-search-clear-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClearSearch();
                  }}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}

              {/* Search Suggestions Dropdown */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="discover-search-suggestions">
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="discover-search-suggestion-item"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="discover-btn-wrapper" ref={sortDropdownRef}>
              <button
                className="discover-filter-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSortDropdownOpen(!isSortDropdownOpen);
                }}
                aria-label="Sort options"
                style={{ position: 'relative' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m7 15 5 5 5-5" />
                  <path d="m7 9 5-5 5 5" />
                </svg>
              </button>
              {isSortDropdownOpen && (
                <div 
                  className="discover-sort-dropdown"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    className="discover-sort-option"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSortSelect('featured');
                    }}
                  >
                    Featured
                  </button>
                  <button
                    className="discover-sort-option"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSortSelect('newest');
                    }}
                  >
                    Latest First
                  </button>
                  <button
                    className="discover-sort-option"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSortSelect('price-low');
                    }}
                  >
                    Price: Low to High
                  </button>
                  <button
                    className="discover-sort-option"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSortSelect('price-high');
                    }}
                  >
                    Price: High to Low
                  </button>
                </div>
              )}
              <span className="discover-tooltip">Sort</span>
            </div>
            <div className="discover-btn-wrapper">
              <button
                className="discover-filter-btn"
                onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                aria-label="Open filters"
                style={{ position: 'relative' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                {hasActivePanelFilters && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-primary)',
                      boxShadow: '0 0 0 2px var(--bg-primary)',
                    }}
                  />
                )}
              </button>
              <span className="discover-tooltip">Filter</span>
            </div>
          </div>

          {/* Filter Panel */}
          {isFilterPanelOpen && (
            <div 
              className="discover-filter-panel-wrapper"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setIsFilterPanelOpen(false);
                }
              }}
            >
              <FilterPanel
                initialFilters={filters}
                onApply={handleApplyFilters}
                onCancel={handleCancelFilters}
              />
            </div>
          )}
        </div>

        {/* Category Chips */}
        <div className="discover-categories">
          <div className="discover-categories-scroll">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                className={`discover-category-chip ${activeCategory === category ? 'active' : ''}`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
            </div>
          </div>
        </div>

        {/* Artwork Grid */}
        <div className="discover-content">
          {loading ? (
            <LoadingState 
              animation={laptopAnimation}
              message="Discovering artworks..." 
              fullHeight 
            />
          ) : (
            <>
              {/* Matched Users Section */}
              {debouncedSearchQuery.trim() && matchedUsers.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    marginBottom: '16px',
                    color: 'var(--color-royal)',
                    paddingLeft: '1rem',
                  }}>
                    Artists
                  </h3>
                  <div className="artist-cards-grid">
                    {matchedUsers.map(user => (
                      <div
                        key={user.uid}
                        onClick={() => handleUserClick(user.uid)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                        }}
                      >
                        <img
                          src={user.avatar || '/artist.png'}
                          alt={user.name}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: '600',
                            fontSize: '14px',
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {user.name}
                          </div>
                          {user.username && (
                            <div style={{
                              fontSize: '13px',
                              color: 'var(--text-secondary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              @{user.username}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Artworks Section */}
              {displayedArtworks.length === 0 && matchedUsers.length === 0 ? (
                <EmptyState
                  animation={noContentAnimation}
                  title="No Artworks Found"
                  description="Check back later for amazing new artworks from talented artists."
                  actionLabel="Go to Home"
                  actionPath="/home"
                />
              ) : displayedArtworks.length > 0 ? (
                <>
                  {debouncedSearchQuery.trim() && (
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      marginBottom: '16px',
                      color: 'var(--color-royal)',
                      paddingLeft: '1rem',
                    }}>
                      Artworks
                    </h3>
                  )}
                  <div ref={artworkGridShellRef}>
                    {shouldVirtualizeGrid && topSpacerHeight > 0 && (
                      <div style={{ height: `${topSpacerHeight}px` }} />
                    )}
                    <ArtworkGrid
                      artworks={virtualizedArtworks.map(artwork => ({
                        id: artwork.id,
                        title: artwork.title,
                        artworkImage: artwork.images[0],
                        artistName: artwork.artistName,
                        artistAvatar: artwork.artistAvatar || '/artist.png',
                        artistId: artwork.artistId,
                        price: artwork.price,
                        sold: artwork.sold,
                      }))}
                      viewType="discover"
                      onArtworkClick={handleArtworkClick}
                      onSave={handleSave}
                      savedArtworks={savedArtworks}
                      currentUserId={appUser?.uid}
                    />
                    {shouldVirtualizeGrid && bottomSpacerHeight > 0 && (
                      <div style={{ height: `${bottomSpacerHeight}px` }} />
                    )}
                  </div>
                  {loadingMore && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      padding: '20px',
                      width: '100%'
                    }}>
                      <div style={{
                        border: '3px solid var(--primary-alpha-20)',
                        borderTop: '3px solid var(--primary)',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                    </div>
                  )}
                  {!hasMore && artworks.length > 0 && (
                    <div style={{
                      textAlign: 'center',
                      padding: '5px',
                      color: 'var(--color-royal)',
                      fontSize: '14px',
                      marginTop: '30px'
                    }}>
                      You've reached the end.
                    </div>
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Discover;
