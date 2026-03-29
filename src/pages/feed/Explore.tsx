import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ArtworkGrid from '../../components/Artwork/ArtworkGrid';
import FilterPanel, { FilterState } from '../../components/Filters/FilterPanel';
import LoadingState from '../../components/State/LoadingState';
import EmptyState from '../../components/State/EmptyState';
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
import { cache } from '../../utils/cache';
import './Explore.css';

const CATEGORIES = ['All', 'Abstract', 'Landscape', 'Portrait', 'Modern', 'Craft', 'Digital', 'Sculpture'];

const exploreCacheKey = (sort: ArtworkFeedSortOption) => `explore_artworks_${sort}`;
const getGridColumnCount = (width: number): number => {
  if (width >= 1440) return 4;
  if (width >= 1024) return 3;
  return 2;
};

const Explore: React.FC = () => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  /* Lock document scroll so only the inner .explore-scroll-container scrolls */
  useEffect(() => {
    document.documentElement.classList.add('explore-page-active');
    document.body.classList.add('explore-page-active');
    return () => {
      document.documentElement.classList.remove('explore-page-active');
      document.body.classList.remove('explore-page-active');
    };
  }, []);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastScrollY = useRef<number>(0);
  const manuallyToggled = useRef<boolean>(false);

  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(true);

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
  const [matchedUsers, setMatchedUsers] = useState<Array<{ uid: string; name: string; username?: string; avatar?: string }>>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [sortOption, setSortOption] = useState<ArtworkFeedSortOption>('featured');
  const [filters, setFilters] = useState<FilterState>({ mediums: [], priceRange: { min: 100, max: 10000000 }, sizes: [] });

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

  /** Search / category / panel filters — drives filtered Firestore scans. */
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

  /** Price sorts always use filtered query; otherwise use simple pagination when unfiltered. */
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

  const savedArtworks = useMemo(() => new Set<string>(), []);

  // Auto-close drawer on scroll down
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Initialize lastScrollY with current scroll position
    lastScrollY.current = container.scrollTop;

    const handleScroll = () => {
      const currentScrollY = container.scrollTop;
      
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

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch with cache (default) or server query (search/filter/sort)
  useEffect(() => {
    let cancelled = false;
    const fetchArtworks = async () => {
      setLoading(true);
      if (needsFilteredQuery) {
        try {
          const result = await getPublishedArtworksFilteredPaginated(queryOptions, 20);
          if (cancelled) return;
          setArtworks(result.artworks);
          setLastVisible(result.lastVisible);
          setHasMore(result.hasMore);
        } catch {
          if (!cancelled) toast.error('Failed to load artworks');
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      const cacheKey = exploreCacheKey(sortOption);
      const cached = cache.get<{ artworks: ArtworkType[]; hasMore: boolean }>(cacheKey);
      if (cached.exists && cached.data) {
        setArtworks(cached.data.artworks);
        setHasMore(cached.data.hasMore);
        if (!cancelled) setLoading(false);
        if (cached.isStale) {
          try {
            const result = await getPublishedArtworksPaginated(20, undefined, paginationOrderMode);
            if (cancelled) return;
            setArtworks(result.artworks);
            setLastVisible(result.lastVisible);
            setHasMore(result.hasMore);
            cache.set(cacheKey, { artworks: result.artworks, hasMore: result.hasMore }, 2 * 60 * 1000, 5 * 60 * 1000);
          } catch {}
        }
        return;
      }
      try {
        const result = await getPublishedArtworksPaginated(20, undefined, paginationOrderMode);
        if (cancelled) return;
        setArtworks(result.artworks);
        setLastVisible(result.lastVisible);
        setHasMore(result.hasMore);
        cache.set(cacheKey, { artworks: result.artworks, hasMore: result.hasMore }, 2 * 60 * 1000, 5 * 60 * 1000);
      } catch (error) {
        if (!cancelled) toast.error('Failed to load artworks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchArtworks();
    return () => { cancelled = true; };
  }, [needsFilteredQuery, queryOptions, sortOption, paginationOrderMode]);

  const loadMoreArtworks = useCallback(async () => {
    if (!hasMore || loadingMore || !lastVisible) return;
    setLoadingMore(true);
    try {
      const result = needsFilteredQuery
        ? await getPublishedArtworksFilteredPaginated(queryOptions, 20, lastVisible)
        : await getPublishedArtworksPaginated(20, lastVisible, paginationOrderMode);
      const updated = [...artworks, ...result.artworks];
      setArtworks(updated);
      setLastVisible(result.lastVisible);
      setHasMore(result.hasMore);
      if (!needsFilteredQuery) {
        cache.set(exploreCacheKey(sortOption), { artworks: updated, hasMore: result.hasMore }, 2 * 60 * 1000, 5 * 60 * 1000);
      }
    } catch {
      toast.error('Failed to load more artworks');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, lastVisible, artworks, needsFilteredQuery, queryOptions, paginationOrderMode, sortOption]);

  // Infinite scroll on the local container
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (!hasMore || loadingMore) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if ((scrollTop + clientHeight) / scrollHeight > 0.8) loadMoreArtworks();
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, loadMoreArtworks]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // User search
  useEffect(() => {
    const run = async () => {
      if (!debouncedSearchQuery.trim()) { setMatchedUsers([]); return; }
      try {
        const q = debouncedSearchQuery.toLowerCase();
        const term = q.includes(' - @') ? q.split(' - @')[1] : q.startsWith('@') ? q.slice(1) : debouncedSearchQuery;
        setMatchedUsers(await searchUsers(term));
      } catch { setMatchedUsers([]); }
    };
    run();
  }, [debouncedSearchQuery]);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) setIsSortDropdownOpen(false);
    };
    if (isSortDropdownOpen) { document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }
  }, [isSortDropdownOpen]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    if (showSuggestions) { document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }
  }, [showSuggestions]);

  // All interactions redirect to login with an info toast
  const goToLogin = () => {
    toast.info('Sign in to access this feature', { toastId: 'explore-login-prompt' });
    navigate('/login');
  };

  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || !artworks.length) return [];
    const q = searchQuery.toLowerCase();
    const s = new Set<string>();
    artworks.forEach(a => {
      if (a.title?.toLowerCase().includes(q)) s.add(a.title);
      if (a.category?.toLowerCase().includes(q)) s.add(a.category);
      if (a.medium?.toLowerCase().includes(q)) s.add(a.medium);
    });
    matchedUsers.forEach(u => {
      if (u.name && u.username) s.add(`${u.name} - @${u.username}`);
      else if (u.username) s.add(`@${u.username}`);
      else if (u.name) s.add(u.name);
    });
    return Array.from(s).slice(0, 8);
  }, [searchQuery, artworks, matchedUsers]);

  const handleClearSearch = () => {
    setSearchQuery('');
    setMatchedUsers([]);
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  const displayedArtworks = artworks;
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
    const scrollContainer = scrollContainerRef.current;
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
    const scrollContainer = scrollContainerRef.current;
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
    <div className="explore-page">
      {/* Scrollable content */}
      <div className="explore-scroll-container" ref={scrollContainerRef}>
        <div className="discover-container explore-container">
          {/* Sticky Header Section */}
          <div className="discover-sticky-header explore-sticky-header">
            <div className="explore-page-header">
              <button className="explore-back-btn" onClick={() => navigate('/')} aria-label="Back to home">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 className="explore-page-title">Explore Art</h1>
                <p className="discover-description explore-description explore-description-mobile-hide" style={{ margin: 0 }}>
                  Explore curated artwork<span className="discover-description-extended"> from talented artists</span>.
                </p>
              </div>
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
                {/* Search bar */}
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
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(e.target.value.trim().length > 0); }}
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
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="discover-search-suggestions">
                    {searchSuggestions.map((s, i) => (
                      <button key={i} className="discover-search-suggestion-item" onClick={() => { setSearchQuery(s); setShowSuggestions(false); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="discover-btn-wrapper" ref={sortDropdownRef}>
                <button className="discover-filter-btn" onClick={() => setIsSortDropdownOpen(v => !v)} aria-label="Sort">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" /></svg>
                </button>
                {isSortDropdownOpen && (
                  <div className="discover-sort-dropdown" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                    {(['featured', 'newest', 'price-low', 'price-high'] as const).map(opt => (
                      <button key={opt} className="discover-sort-option" onClick={() => { setSortOption(opt); setIsSortDropdownOpen(false); }}>
                        {opt === 'featured'
                          ? 'Featured'
                          : opt === 'price-low'
                            ? 'Price: Low to High'
                            : opt === 'price-high'
                              ? 'Price: High to Low'
                              : 'Latest First'}
                      </button>
                    ))}
                  </div>
                )}
                <span className="discover-tooltip">Sort</span>
              </div>
              <div className="discover-btn-wrapper">
                <button className="discover-filter-btn" onClick={() => setIsFilterPanelOpen(v => !v)} aria-label="Filter" style={{ position: 'relative' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
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
            {isFilterPanelOpen && (
              <div className="discover-filter-panel-wrapper" onClick={e => e.target === e.currentTarget && setIsFilterPanelOpen(false)}>
                <FilterPanel initialFilters={filters} onApply={f => { setFilters(f); setIsFilterPanelOpen(false); }} onCancel={() => setIsFilterPanelOpen(false)} />
              </div>
            )}
          </div>

          {/* Category chips */}
          <div className="discover-categories">
            <div className="discover-categories-scroll">
              {CATEGORIES.map(cat => (
                <button key={cat} className={`discover-category-chip ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>{cat}</button>
              ))}
            </div>
          </div>
              </div>
            </div>
          </div>

          {/* Artwork grid */}
          <div className="discover-content">
            {loading ? (
              <LoadingState animation={laptopAnimation} message="Loading artworks..." fullHeight />
            ) : (
              <>
                {debouncedSearchQuery.trim() && matchedUsers.length > 0 && (
                  <div style={{ marginBottom: 30 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--color-royal)', paddingLeft: '1rem' }}>Artists</h3>
                    <div className="artist-cards-grid">
                      {matchedUsers.map(user => (
                        <div key={user.uid} onClick={goToLogin}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                        >
                          <img src={user.avatar || '/artist.png'} alt={user.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                            {user.username && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>@{user.username}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {displayedArtworks.length === 0 && matchedUsers.length === 0 ? (
                  <EmptyState animation={noContentAnimation} title="No Artworks Found" description="Check back later for amazing artworks from talented artists." actionLabel="Go to Home" actionPath="/" />
                ) : displayedArtworks.length > 0 ? (
                  <>
                    {debouncedSearchQuery.trim() && <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--color-royal)', paddingLeft: '1rem' }}>Artworks</h3>}
                    <div ref={artworkGridShellRef}>
                      {shouldVirtualizeGrid && topSpacerHeight > 0 && (
                        <div style={{ height: `${topSpacerHeight}px` }} />
                      )}
                      <ArtworkGrid
                        artworks={virtualizedArtworks.map(a => ({ id: a.id, title: a.title, artworkImage: a.images[0], artistName: a.artistName, artistAvatar: a.artistAvatar || '/artist.png', artistId: a.artistId, price: a.price, sold: a.sold }))}
                        viewType="discover"
                        onArtworkClick={goToLogin}
                        onArtistClick={goToLogin}
                        onSave={goToLogin}
                        savedArtworks={savedArtworks}
                      />
                      {shouldVirtualizeGrid && bottomSpacerHeight > 0 && (
                        <div style={{ height: `${bottomSpacerHeight}px` }} />
                      )}
                    </div>
                    {loadingMore && (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                        <div style={{ border: '3px solid var(--primary-alpha-20)', borderTop: '3px solid var(--color-primary)', borderRadius: '50%', width: 40, height: 40, animation: 'spin 1s linear infinite' }} />
                      </div>
                    )}
                    {!hasMore && artworks.length > 0 && (
                      <div style={{ textAlign: 'center', padding: 5, color: 'var(--color-royal)', fontSize: 14, marginTop: 30 }}>You've reached the end.</div>
                    )}
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Explore;
