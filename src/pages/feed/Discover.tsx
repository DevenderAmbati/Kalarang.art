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
import { getPublishedArtworksPaginated } from '../../services/artworkService';
import { searchUsers } from '../../services/userService';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import laptopAnimation from '../../animations/Laptop-Drawing 1.json';
import noContentAnimation from '../../animations/no content.json';
import { toast } from 'react-toastify';
import { cache, cacheKeys } from '../../utils/cache';
import './Discover.css';

// Size categories with dimensions in inches
const SIZE_CATEGORIES = [
  { label: 'Small', minWidth: 0, maxWidth: 8, minHeight: 0, maxHeight: 8 },
  { label: 'Medium', minWidth: 8, maxWidth: 18, minHeight: 8, maxHeight: 18 },
  { label: 'Large', minWidth: 18, maxWidth: 500, minHeight: 18, maxHeight: 500 },
];

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

const parseInches = (value?: string): number | null => {
  if (!value) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

const Discover: React.FC = () => {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
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
  const [sortOption, setSortOption] = useState<'price-low' | 'price-high' | 'newest'>('newest');
  const [filters, setFilters] = useState<FilterState>({
    mediums: [],
    priceRange: { min: 100, max: 200000 },
    sizes: [],
  });

  // Infinite scroll state
  const [artworks, setArtworks] = useState<ArtworkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Use cached data hooks
  const { data: favoriteIds, updateCache: updateFavoritesCache, refetch: refetchFavorites } = useFavorites(appUser?.uid);

  // Listen for favorites changes from other components
  useEffect(() => {
    const handleFavoritesChanged = ((e: CustomEvent) => {
      if (e.detail.userId === appUser?.uid) {
        console.log('[Discover] Favorites changed in another component, refetching...');
        refetchFavorites();
      }
    }) as EventListener;
    
    window.addEventListener('favorites-changed', handleFavoritesChanged);
    return () => window.removeEventListener('favorites-changed', handleFavoritesChanged);
  }, [appUser?.uid, refetchFavorites]);

  // Ensure favorites are loaded
  useEffect(() => {
    if (appUser?.uid && !favoriteIds) {
      console.log('[Discover] Fetching favorites on mount');
      refetchFavorites();
    }
  }, [appUser?.uid, favoriteIds, refetchFavorites]);

  // Initial data fetch with cache
  useEffect(() => {
    const fetchInitialArtworks = async () => {
      // Try to get from cache first
      const cached = cache.get<{
        artworks: ArtworkType[];
        hasMore: boolean;
      }>(cacheKeys.discoverPaginated());

      if (cached.exists && cached.data) {
        // Load from cache immediately
        console.log('[Cache] Loading discover data from cache');
        setArtworks(cached.data.artworks);
        setHasMore(cached.data.hasMore);
        setLoading(false);

        // If cache is stale, fetch fresh data in background
        if (cached.isStale) {
          console.log('[Cache] Cache is stale, refreshing in background');
          try {
            const result = await getPublishedArtworksPaginated(20);
            setArtworks(result.artworks);
            setLastVisible(result.lastVisible);
            setHasMore(result.hasMore);
            
            // Update cache
            cache.set(
              cacheKeys.discoverPaginated(),
              { artworks: result.artworks, hasMore: result.hasMore },
              2 * 60 * 1000, // 2 minutes stale time
              5 * 60 * 1000  // 5 minutes cache time
            );
          } catch (error) {
            console.error('Error refreshing artworks:', error);
          }
        }
        return;
      }

      // No cache, fetch fresh data
      setLoading(true);
      try {
        console.log('[API] Fetching initial discover data');
        const result = await getPublishedArtworksPaginated(20);
        setArtworks(result.artworks);
        setLastVisible(result.lastVisible);
        setHasMore(result.hasMore);
        
        // Store in cache
        cache.set(
          cacheKeys.discoverPaginated(),
          { artworks: result.artworks, hasMore: result.hasMore },
          2 * 60 * 1000, // 2 minutes stale time
          5 * 60 * 1000  // 5 minutes cache time
        );
      } catch (error) {
        console.error('Error fetching artworks:', error);
        toast.error('Failed to load artworks');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialArtworks();
  }, []);

  // Load more artworks
  const loadMoreArtworks = useCallback(async () => {
    if (!hasMore || loadingMore || !lastVisible) return;

    setLoadingMore(true);
    try {
      console.log('[API] Loading more discover artworks');
      const result = await getPublishedArtworksPaginated(20, lastVisible);
      const updatedArtworks = [...artworks, ...result.artworks];
      setArtworks(updatedArtworks);
      setLastVisible(result.lastVisible);
      setHasMore(result.hasMore);
      
      // Update cache with accumulated artworks
      cache.set(
        cacheKeys.discoverPaginated(),
        { artworks: updatedArtworks, hasMore: result.hasMore },
        2 * 60 * 1000, // 2 minutes stale time
        5 * 60 * 1000  // 5 minutes cache time
      );
    } catch (error) {
      console.error('Error loading more artworks:', error);
      toast.error('Failed to load more artworks');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, lastVisible, artworks]);

  // Infinite scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (!hasMore || loadingMore) return;

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
  }, [hasMore, loadingMore, loadMoreArtworks]);

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
        } catch (error) {
          console.error('Error searching users:', error);
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
        toast.success('Removed from favorites');
      } else {
        await saveArtworkToFavorites(appUser.uid, id, appUser.name, appUser.avatar);
        toast.success('Saved to your favourites');
      }
      // Invalidate favorite artworks cache
      cache.invalidate(cacheKeys.favoriteArtworks(appUser.uid));
      cache.invalidate(cacheKeys.favorites(appUser.uid));
      
      // Broadcast change to other components
      window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { userId: appUser.uid } }));
    } catch (error) {
      console.error('Error toggling save:', error);
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

  const handleSortSelect = (option: 'price-low' | 'price-high' | 'newest') => {
    setSortOption(option);
    setIsSortDropdownOpen(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(value.trim().length > 0);
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

  // Filter artworks based on active category and filters (memoized)
  const filteredArtworks = useMemo(() => {
    return (artworks || []).filter(artwork => {
      // Search query filter - search in title, description, artist name, category, and medium
      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase();
        
        // Check if searching by artist with "Name - @username" format
        if (query.includes(' - @')) {
          const parts = query.split(' - @');
          const username = parts[1]; // username without @
          
          // Find the artist by username
          const artist = matchedUsers.find(u => u.username?.toLowerCase() === username.toLowerCase());
          
          if (artist) {
            // Match by artist ID primarily
            if (artwork.artistId === artist.uid) {
              return true;
            }
          }
          
          // Fallback: also search in other fields
          const searchTerms = [parts[0], username]; // name and username
          return searchTerms.some(term => 
            artwork.title?.toLowerCase().includes(term) ||
            artwork.description?.toLowerCase().includes(term) ||
            artwork.category?.toLowerCase().includes(term) ||
            artwork.medium?.toLowerCase().includes(term)
          );
        } else if (query.startsWith('@')) {
          // Searching by @username only
          const username = query.substring(1);
          
          // Find the artist by username
          const artist = matchedUsers.find(u => u.username?.toLowerCase() === username.toLowerCase());
          
          if (artist) {
            // Match by artist ID primarily
            if (artwork.artistId === artist.uid) {
              return true;
            }
          }
          
          // Fallback: search in other fields
          return (
            artwork.title?.toLowerCase().includes(username) ||
            artwork.description?.toLowerCase().includes(username) ||
            artwork.artistName?.toLowerCase().includes(username) ||
            artwork.category?.toLowerCase().includes(username) ||
            artwork.medium?.toLowerCase().includes(username)
          );
        } else {
          // Regular search in all fields
          const matchesSearch = 
            artwork.title?.toLowerCase().includes(query) ||
            artwork.description?.toLowerCase().includes(query) ||
            artwork.artistName?.toLowerCase().includes(query) ||
            artwork.category?.toLowerCase().includes(query) ||
            artwork.medium?.toLowerCase().includes(query);
          
          if (!matchesSearch) return false;
        }
      }

    // Category filter
    if (activeCategory !== 'All') {
      if (artwork.category?.toLowerCase() !== activeCategory.toLowerCase()) {
        return false;
      }
    }

    // Medium filter
    if (filters.mediums.length > 0) {
      if (!filters.mediums.some(medium => 
        artwork.medium?.toLowerCase() === medium.toLowerCase()
      )) {
        return false;
      }
    }

    // Price filter
    if (artwork.price < filters.priceRange.min || artwork.price > filters.priceRange.max) {
      return false;
    }

    // Size filter (if you have width/height fields)
    if (filters.sizes.length > 0) {
      const width = parseInches(artwork.width);
      const height = parseInches(artwork.height);

      // If artwork doesn't have dimensions, exclude it from size-filtered results
      if (width === null || height === null) {
        return false;
      }

      // Check if artwork matches any of the selected size categories
      const matchesSize = filters.sizes.some(selectedSize => {
        const sizeCategory = SIZE_CATEGORIES.find(s => s.label === selectedSize);
        if (!sizeCategory) return false;

        return (
          width >= sizeCategory.minWidth &&
          width <= sizeCategory.maxWidth &&
          height >= sizeCategory.minHeight &&
          height <= sizeCategory.maxHeight
        );
      });

      if (!matchesSize) {
        return false;
      }
    }

    return true;
  });
  }, [artworks, debouncedSearchQuery, activeCategory, filters, matchedUsers]);

  // Sort filtered artworks
  const sortedArtworks = React.useMemo(() => {
    return [...filteredArtworks].sort((a, b) => {
      switch (sortOption) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'newest':
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        default:
          return 0;
      }
    });
  }, [filteredArtworks, sortOption]);

  return (
    <>
      <div className="discover-container">
        <div className="discover-header">
          <p className="discover-description">
            Explore curated artwork from talented artists.
          </p>
        </div>

        {/* Search Bar */}
        <div className="discover-search-container">
          <div className="discover-search-bar" ref={searchContainerRef}>
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
            />
            
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
                  <button
                    className="discover-sort-option"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSortSelect('newest');
                    }}
                  >
                    Latest First
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
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
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
              {sortedArtworks.length === 0 && matchedUsers.length === 0 ? (
                <EmptyState
                  animation={noContentAnimation}
                  title="No Artworks Found"
                  description="Check back later for amazing new artworks from talented artists."
                  actionLabel="Go to Home"
                  actionPath="/home"
                />
              ) : sortedArtworks.length > 0 ? (
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
                  <ArtworkGrid 
                    artworks={sortedArtworks.map(artwork => ({
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
