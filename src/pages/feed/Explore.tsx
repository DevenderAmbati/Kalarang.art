import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ArtworkGrid from '../../components/Artwork/ArtworkGrid';
import FilterPanel, { FilterState } from '../../components/Filters/FilterPanel';
import LoadingState from '../../components/State/LoadingState';
import EmptyState from '../../components/State/EmptyState';
import { Artwork as ArtworkType } from '../../types/artwork';
import { getPublishedArtworksPaginated } from '../../services/artworkService';
import { searchUsers } from '../../services/userService';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import laptopAnimation from '../../animations/Laptop-Drawing 1.json';
import noContentAnimation from '../../animations/no content.json';
import { toast } from 'react-toastify';
import { cache } from '../../utils/cache';
import './Explore.css';

const SIZE_CATEGORIES = [
  { label: 'Small', minWidth: 0, maxWidth: 8, minHeight: 0, maxHeight: 8 },
  { label: 'Medium', minWidth: 8, maxWidth: 18, minHeight: 8, maxHeight: 18 },
  { label: 'Large', minWidth: 18, maxWidth: 500, minHeight: 18, maxHeight: 500 },
];

const CATEGORIES = ['All', 'Abstract', 'Landscape', 'Portrait', 'Modern', 'Craft', 'Digital', 'Sculpture'];

const EXPLORE_CACHE_KEY = 'explore_artworks';

const parseInches = (value?: string): number | null => {
  if (!value) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

const Explore: React.FC = () => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [matchedUsers, setMatchedUsers] = useState<Array<{ uid: string; name: string; username?: string; avatar?: string }>>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [sortOption, setSortOption] = useState<'price-low' | 'price-high' | 'newest'>('newest');
  const [filters, setFilters] = useState<FilterState>({ mediums: [], priceRange: { min: 100, max: 200000 }, sizes: [] });

  const [artworks, setArtworks] = useState<ArtworkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const savedArtworks = useMemo(() => new Set<string>(), []);

  // Initial fetch with cache
  useEffect(() => {
    const fetchArtworks = async () => {
      const cached = cache.get<{ artworks: ArtworkType[]; hasMore: boolean }>(EXPLORE_CACHE_KEY);
      if (cached.exists && cached.data) {
        setArtworks(cached.data.artworks);
        setHasMore(cached.data.hasMore);
        setLoading(false);
        if (cached.isStale) {
          try {
            const result = await getPublishedArtworksPaginated(20);
            setArtworks(result.artworks);
            setLastVisible(result.lastVisible);
            setHasMore(result.hasMore);
            cache.set(EXPLORE_CACHE_KEY, { artworks: result.artworks, hasMore: result.hasMore }, 2 * 60 * 1000, 5 * 60 * 1000);
          } catch {}
        }
        return;
      }
      setLoading(true);
      try {
        const result = await getPublishedArtworksPaginated(20);
        setArtworks(result.artworks);
        setLastVisible(result.lastVisible);
        setHasMore(result.hasMore);
        cache.set(EXPLORE_CACHE_KEY, { artworks: result.artworks, hasMore: result.hasMore }, 2 * 60 * 1000, 5 * 60 * 1000);
      } catch (error) {
        toast.error('Failed to load artworks');
      } finally {
        setLoading(false);
      }
    };
    fetchArtworks();
  }, []);

  const loadMoreArtworks = useCallback(async () => {
    if (!hasMore || loadingMore || !lastVisible) return;
    setLoadingMore(true);
    try {
      const result = await getPublishedArtworksPaginated(20, lastVisible);
      const updated = [...artworks, ...result.artworks];
      setArtworks(updated);
      setLastVisible(result.lastVisible);
      setHasMore(result.hasMore);
      cache.set(EXPLORE_CACHE_KEY, { artworks: updated, hasMore: result.hasMore }, 2 * 60 * 1000, 5 * 60 * 1000);
    } catch {
      toast.error('Failed to load more artworks');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, lastVisible, artworks]);

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

  const filteredArtworks = useMemo(() => {
    return artworks.filter(a => {
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase();
        if (q.includes(' - @')) {
          const [namePart, userPart] = q.split(' - @');
          const artist = matchedUsers.find(u => u.username?.toLowerCase() === userPart);
          if (artist && a.artistId === artist.uid) return true;
          return [namePart, userPart].some(t => a.title?.toLowerCase().includes(t) || a.description?.toLowerCase().includes(t) || a.category?.toLowerCase().includes(t) || a.medium?.toLowerCase().includes(t));
        }
        if (q.startsWith('@')) {
          const un = q.slice(1);
          const artist = matchedUsers.find(u => u.username?.toLowerCase() === un);
          if (artist && a.artistId === artist.uid) return true;
          return a.title?.toLowerCase().includes(un) || a.artistName?.toLowerCase().includes(un) || a.category?.toLowerCase().includes(un) || a.medium?.toLowerCase().includes(un);
        }
        if (!(a.title?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q) || a.artistName?.toLowerCase().includes(q) || a.category?.toLowerCase().includes(q) || a.medium?.toLowerCase().includes(q))) return false;
      }
      if (activeCategory !== 'All' && a.category?.toLowerCase() !== activeCategory.toLowerCase()) return false;
      if (filters.mediums.length > 0 && !filters.mediums.some(m => a.medium?.toLowerCase() === m.toLowerCase())) return false;
      if (a.price < filters.priceRange.min || a.price > filters.priceRange.max) return false;
      if (filters.sizes.length > 0) {
        const w = parseInches(a.width), h = parseInches(a.height);
        if (w === null || h === null) return false;
        if (!filters.sizes.some(sz => { const sc = SIZE_CATEGORIES.find(s => s.label === sz); return sc && w >= sc.minWidth && w <= sc.maxWidth && h >= sc.minHeight && h <= sc.maxHeight; })) return false;
      }
      return true;
    });
  }, [artworks, debouncedSearchQuery, activeCategory, filters, matchedUsers]);

  const sortedArtworks = useMemo(() => {
    return [...filteredArtworks].sort((a, b) => {
      if (sortOption === 'price-low') return a.price - b.price;
      if (sortOption === 'price-high') return b.price - a.price;
      const da = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const db = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return db.getTime() - da.getTime();
    });
  }, [filteredArtworks, sortOption]);

  return (
    <div className="explore-page">
      {/* Scrollable content */}
      <div className="explore-scroll-container" ref={scrollContainerRef}>
        <div className="discover-container explore-container">
          <div className="explore-page-header">
            <button className="explore-back-btn" onClick={() => navigate('/')} aria-label="Back to home">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="explore-page-title">Explore Art</h1>
              <p className="discover-description" style={{ margin: '0 0 0.75rem' }}>Explore curated artwork from talented.</p>
            </div>
          </div>

          {/* Search bar */}
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
                onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(e.target.value.trim().length > 0); }}
                onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
              />
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
              <div className="discover-btn-wrapper" ref={sortDropdownRef}>
                <button className="discover-filter-btn" onClick={() => setIsSortDropdownOpen(v => !v)} aria-label="Sort">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" /></svg>
                </button>
                {isSortDropdownOpen && (
                  <div className="discover-sort-dropdown" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                    {(['price-low', 'price-high', 'newest'] as const).map(opt => (
                      <button key={opt} className="discover-sort-option" onClick={() => { setSortOption(opt); setIsSortDropdownOpen(false); }}>
                        {opt === 'price-low' ? 'Price: Low to High' : opt === 'price-high' ? 'Price: High to Low' : 'Latest First'}
                      </button>
                    ))}
                  </div>
                )}
                <span className="discover-tooltip">Sort</span>
              </div>
              <div className="discover-btn-wrapper">
                <button className="discover-filter-btn" onClick={() => setIsFilterPanelOpen(v => !v)} aria-label="Filter">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
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

                {sortedArtworks.length === 0 && matchedUsers.length === 0 ? (
                  <EmptyState animation={noContentAnimation} title="No Artworks Found" description="Check back later for amazing artworks from talented artists." actionLabel="Go to Home" actionPath="/" />
                ) : sortedArtworks.length > 0 ? (
                  <>
                    {debouncedSearchQuery.trim() && <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--color-royal)', paddingLeft: '1rem' }}>Artworks</h3>}
                    <ArtworkGrid
                      artworks={sortedArtworks.map(a => ({ id: a.id, title: a.title, artworkImage: a.images[0], artistName: a.artistName, artistAvatar: a.artistAvatar || '/artist.png', artistId: a.artistId, price: a.price, sold: a.sold }))}
                      viewType="discover"
                      onArtworkClick={goToLogin}
                      onArtistClick={goToLogin}
                      onSave={goToLogin}
                      savedArtworks={savedArtworks}
                    />
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
