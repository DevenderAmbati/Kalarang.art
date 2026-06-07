import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import CollapsedSidebar from './CollapsedSidebar';
import BottomNav from './BottomNav';
import { logout } from '../../services/authService';
import { useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import { FaUserCircle } from 'react-icons/fa';
import { IoMdNotifications } from 'react-icons/io';
import { PiChatsBold } from 'react-icons/pi';
import NotificationModal from '../Modals/NotificationModal';
import ChatDrawer from '../Chat/ChatDrawer';
import BuyingFlowInfoModal from '../Modals/BuyingFlowInfoModal';
import { subscribeToUnreadCount } from '../../services/notificationService';
import { useChatContext } from '../../context/ChatContext';
import InstallBanner from '../Common/InstallPrompt';
import NotificationBanner from '../Common/NotificationPrompt';
import './Layout.css';

interface LayoutProps {
  children?: React.ReactNode;
  onLogout: () => void;
  pageTitle?: string;
  homeFeedComponent?: React.ReactNode;
  discoverComponent?: React.ReactNode;
  favouritesComponent?: React.ReactNode;
  commissionsComponent?: React.ReactNode;
  postComponent?: React.ReactNode;
}

const handleLogout = async () => {
  await logout();
};

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  onLogout, 
  pageTitle = 'Dashboard',
  homeFeedComponent,
  discoverComponent,
  favouritesComponent,
  commissionsComponent,
  postComponent,
}) => {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [, forceUpdate] = useState({});
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isBuyingFlowInfoOpen, setIsBuyingFlowInfoOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { unreadCount: unreadChatCount, isChatDrawerOpen, setIsChatDrawerOpen } = useChatContext();
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(48);
  const [installBannerVisible, setInstallBannerVisible] = useState(false);

  const homeFeedScrollRef = useRef<HTMLDivElement | null>(null);
  const discoverScrollRef = useRef<HTMLDivElement | null>(null);
  const favouritesScrollRef = useRef<HTMLDivElement | null>(null);
  const commissionsScrollRef = useRef<HTMLDivElement | null>(null);
  const postScrollRef = useRef<HTMLDivElement | null>(null);
  const standardScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setHeaderHeight(el.offsetHeight);
    });
    ro.observe(el);
    setHeaderHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  // Subscribe to unread notification count
  useEffect(() => {
    if (!appUser?.uid) return;

    const unsubscribe = subscribeToUnreadCount(appUser.uid, (count) => {
      setUnreadCount(count);
    });

    return () => unsubscribe();
  }, [appUser?.uid]);

  // Force re-render when document title changes (for dynamic portfolio titles)
  useEffect(() => {
    const interval = setInterval(() => {
      if (location.pathname.startsWith('/portfolio/')) {
        forceUpdate({});
      }
    }, 100);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const handleProfileClick = () => {
    if (appUser?.role === 'artist') {
      navigate('/account');
      return;
    }
    navigate('/profile');
  };

  // Detect which route is active
  const isHomeFeedActive = location.pathname === '/home';
  const isDiscoverActive = location.pathname === '/discover';
  const isFavouritesActive = location.pathname === '/favourites';
  const isCommissionsActive = location.pathname === '/commissions';
  const isPostActive = location.pathname === '/post';
  const isArtworkDetail = location.pathname.startsWith('/card/');
  const isOtherUserPortfolio = location.pathname.startsWith('/portfolio/') && location.pathname !== '/portfolio';

  /** Public share views: no app chrome so guests get a clean landing page */
  const hideAppNav =
    !appUser && (isArtworkDetail || isOtherUserPortfolio);
  
  const isPersistentMode = !!(homeFeedComponent && discoverComponent && favouritesComponent);
  
  const showPersistentPages =
    isPersistentMode &&
    (isHomeFeedActive ||
      isDiscoverActive ||
      isFavouritesActive ||
      isCommissionsActive ||
      isPostActive ||
      isArtworkDetail ||
      isOtherUserPortfolio);

  const isFeedTabActive = isHomeFeedActive || isDiscoverActive || isFavouritesActive || isCommissionsActive || isPostActive;

  /* No sessionStorage scroll save/restore needed for the 5 main tabs.
     Each has its own always-mounted scroll div — the browser preserves
     scrollTop natively because the element never leaves the DOM. */

  // Determine page title based on route
  const getPageTitle = () => {
    if (isHomeFeedActive) return 'Home';
    if (isDiscoverActive) return 'Explore';
    if (isFavouritesActive) return 'Favourites';
    if (location.pathname === '/commissions') return 'Comission Board';
    if (location.pathname === '/post' && appUser?.role === 'buyer') return 'Post Comission';
    if (location.pathname === '/post' && appUser?.role === 'artist') return 'Upload Artwork';
    if (isArtworkDetail) return 'Artwork';
    if (location.pathname === '/account') return 'Account';
    if (location.pathname === '/portfolio') return 'Portfolio';
    if (location.pathname.startsWith('/portfolio/')) {
      // Extract first name from document title if available
      const titleMatch = document.title.match(/^(.+?)'s Portfolio/);
      return titleMatch ? `${titleMatch[1]}'s Portfolio` : 'Portfolio';
    }
    if (location.pathname === '/profile') return 'Profile';
    return pageTitle;
  };

  const getPageSubtitle = () => {
    return '';
  };
  
  return (
    <div
      style={styles.container}
      className={hideAppNav ? 'layout-public-minimal' : undefined}
    >
      {!hideAppNav &&
        (isCollapsed ? (
          <CollapsedSidebar onExpand={toggleSidebar} />
        ) : (
          <Sidebar onLogout={onLogout} />
        ))}
      <main
        className="layout-main-content"
        style={{
          ...styles.main,
          marginLeft: hideAppNav ? 0 : isCollapsed ? '80px' : '260px',
          '--header-height': `${headerHeight}px`,
        } as React.CSSProperties}
      >
        {/* Header with Page Title */}
        <div ref={headerRef} className="layout-header" style={styles.header}>
          <div className="header-row" style={styles.headerRow}>
            <div className="header-left" style={styles.headerLeft}>
              {/* Desktop - show page title with sidebar */}
              <div className="header-title-desktop" style={styles.pageTitleBlock}>
                <h1 style={styles.pageTitle}>{getPageTitle()}</h1>
                {getPageSubtitle() && <p style={styles.pageSubtitle}>{getPageSubtitle()}</p>}
              </div>
              {/* Mobile - show logo with bottom nav */}
              <img 
                src="/header_logo.png" 
                alt="Kalarang Logo" 
                style={styles.headerLogo}
                className="header-logo-mobile"
              />
            </div>
            <div className="header-right" style={styles.headerRight}>
              {hideAppNav && (
                <div style={styles.publicHeaderActions}>
                  <button
                    type="button"
                    style={styles.publicHeaderLink}
                    onClick={() => {
                      sessionStorage.setItem('postAuthRedirect', location.pathname);
                      navigate('/login');
                    }}
                  >
                    Log in
                  </button>
                  <button
                    type="button"
                    style={styles.publicHeaderCta}
                    onClick={() => {
                      sessionStorage.setItem('postAuthRedirect', location.pathname);
                      navigate('/signup');
                    }}
                  >
                    Sign up
                  </button>
                </div>
              )}
              {appUser && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setIsBuyingFlowInfoOpen(true)}
                    aria-label="How buying works"
                    title="How buying works"
                    style={styles.buyingInfoIconBtn}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </button>
                  <div
                    onClick={() => setIsChatDrawerOpen(true)}
                    style={{...styles.notificationIcon, position: 'relative'}}
                    className="layout-notification-icon"
                    aria-label="Messages"
                  >
                    {PiChatsBold({ size: 26 })}
                    {unreadChatCount > 0 && (
                      <div style={styles.unreadBadge}>
                        {unreadChatCount > 99 ? '99+' : unreadChatCount}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {appUser && (
                <div 
                  onClick={() => setIsNotificationModalOpen(true)}
                  style={{...styles.notificationIcon, position: 'relative'}} 
                  className="layout-notification-icon"
                >
                  {IoMdNotifications({ size: 24 })}
                  {unreadCount > 0 && (
                    <div style={styles.unreadBadge}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}
                </div>
              )}
              {appUser && (
                <div onClick={handleProfileClick} style={styles.profileIcon} className="layout-profile-icon">
                  <img
                    src={appUser.avatar || (appUser.role === 'artist' ? '/artist.png' : '/man-with-hat.png')}
                    alt={appUser.role === 'artist' ? 'Artist Profile' : 'Buyer Profile'}
                    style={styles.profileImage}
                  />
                </div>
              )}
            </div>
          </div>
          <InstallBanner onVisibilityChange={setInstallBannerVisible} />
          {!installBannerVisible && <NotificationBanner />}
        </div>
        <div style={styles.contentWrapper}>
          {showPersistentPages ? (
            <>
              {/* HomeFeed — always mounted, hidden when inactive */}
              <div
                className={!hideAppNav ? 'layout-inner-scroll--with-bottom-nav' : undefined}
                ref={homeFeedScrollRef}
                style={{...(isHomeFeedActive && !isArtworkDetail && !isOtherUserPortfolio ? styles.feedScrollContainer : styles.feedScrollContainerHidden), paddingTop: `${headerHeight}px`}}
              >
                {homeFeedComponent}
              </div>

              {/* Discover — always mounted, hidden when inactive */}
              <div
                className={!hideAppNav ? 'layout-inner-scroll--with-bottom-nav' : undefined}
                ref={discoverScrollRef}
                style={{...(isDiscoverActive && !isArtworkDetail && !isOtherUserPortfolio ? styles.feedScrollContainer : styles.feedScrollContainerHidden), paddingTop: `${headerHeight}px`}}
              >
                {discoverComponent}
              </div>

              {/* Favourites — always mounted, hidden when inactive */}
              <div
                className={!hideAppNav ? 'layout-inner-scroll--with-bottom-nav' : undefined}
                ref={favouritesScrollRef}
                style={{...(isFavouritesActive && !isArtworkDetail && !isOtherUserPortfolio ? styles.feedScrollContainer : styles.feedScrollContainerHidden), paddingTop: `${headerHeight}px`}}
              >
                {favouritesComponent}
              </div>

              {/* Commissions — always mounted, hidden when inactive */}
              {commissionsComponent && (
                <div
                  className={!hideAppNav ? 'layout-inner-scroll--with-bottom-nav standard-scroll-container' : 'standard-scroll-container'}
                  ref={commissionsScrollRef}
                  style={{...(isCommissionsActive && !isArtworkDetail && !isOtherUserPortfolio ? styles.feedScrollContainer : styles.feedScrollContainerHidden), paddingTop: `${headerHeight}px`}}
                >
                  {commissionsComponent}
                </div>
              )}

              {/* Post — always mounted, hidden when inactive */}
              {postComponent && (
                <div
                  className={!hideAppNav ? 'layout-inner-scroll--with-bottom-nav standard-scroll-container' : 'standard-scroll-container'}
                  ref={postScrollRef}
                  style={{...(isPostActive && !isArtworkDetail && !isOtherUserPortfolio ? styles.feedScrollContainer : styles.feedScrollContainerHidden), paddingTop: `${headerHeight}px`}}
                >
                  {postComponent}
                </div>
              )}

              {/* ArtworkDetail — ephemeral, only when route is active */}
              {isArtworkDetail && (
                <div
                  className={
                    hideAppNav
                      ? 'layout-scroll-pad-guest'
                      : 'layout-inner-scroll--with-bottom-nav'
                  }
                  style={{
                    ...styles.artworkDetailScrollContainer,
                    paddingTop: `${headerHeight}px`,
                  }}
                >
                  {children}
                </div>
              )}

              {/* OtherUserPortfolio — ephemeral, only when route is active */}
              {isOtherUserPortfolio && (
                <div
                  className={
                    hideAppNav
                      ? 'layout-scroll-pad-guest'
                      : 'layout-inner-scroll--with-bottom-nav'
                  }
                  style={{
                    ...styles.artworkDetailScrollContainer,
                    paddingTop: `${headerHeight}px`,
                  }}
                >
                  {children}
                </div>
              )}

              {/* Fallback for any other children under this shell */}
              {!isFeedTabActive && !isArtworkDetail && !isOtherUserPortfolio && (
                <div
                  ref={standardScrollRef}
                  className={!hideAppNav ? 'layout-inner-scroll--with-bottom-nav standard-scroll-container' : 'standard-scroll-container'}
                  style={{...styles.standardScrollContainer, paddingTop: `${headerHeight}px`, '--header-height': `${headerHeight}px`} as React.CSSProperties}
                >
                  {children}
                </div>
              )}
            </>
          ) : (
            <div
              ref={standardScrollRef}
              className={!hideAppNav ? 'layout-inner-scroll--with-bottom-nav standard-scroll-container' : 'standard-scroll-container'}
              style={{...styles.standardScrollContainer, paddingTop: `${headerHeight}px`, '--header-height': `${headerHeight}px`} as React.CSSProperties}
            >
              {children}
            </div>
          )}
        </div>
        
        {/* Notification Modal */}
        <NotificationModal 
          isOpen={isNotificationModalOpen}
          onClose={() => setIsNotificationModalOpen(false)}
        />

        {/* WhatsApp-style Chat Drawer — opens directly from header icon */}
        <ChatDrawer
          isOpen={isChatDrawerOpen}
          onClose={() => setIsChatDrawerOpen(false)}
        />

        {/* Buying flow info modal */}
        {appUser && (
          <BuyingFlowInfoModal
            isOpen={isBuyingFlowInfoOpen}
            onClose={() => setIsBuyingFlowInfoOpen(false)}
            userRole={appUser.role as 'artist' | 'buyer'}
          />
        )}
      </main>
      {!hideAppNav && <BottomNav />}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    minHeight: '0',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(90deg, #E8F4F5 0%, #c1f8fdff 100%)',
    borderBottom: '1px solid rgba(47, 164, 169, 0.2)',
    boxShadow: '0 4px 16px rgba(47, 164, 169, 0.15)',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 100,
  } as React.CSSProperties,
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 1.25rem',
  } as React.CSSProperties,
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    marginRight: '0rem',
    minHeight: '40px', // Maintain height even when empty
    minWidth: '40px', // Maintain width even when empty
  } as React.CSSProperties,
  profileIcon: {
    color: 'var(--color-primary)',
    cursor: 'pointer',
    transition: 'var(--transition-base)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  pageTitle: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--color-text-primary-light)',
    fontFamily: '"Poppins", "Segoe UI", "Roboto", sans-serif',
    letterSpacing: '0px',
  } as React.CSSProperties,
  pageTitleBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.08rem',
  } as React.CSSProperties,
  pageSubtitle: {
    margin: 0,
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  } as React.CSSProperties,
  headerLogo: {
    height: '40px',
    width: 'auto',
    objectFit: 'contain',
  } as React.CSSProperties,
  profileImage: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    border: '2px solid var(--color-primary)',
  } as React.CSSProperties,
  notificationIcon: {
    cursor: 'pointer',
    color: 'var(--color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    transition: 'all 0.3s ease',
    marginRight: '0.5rem',
    marginLeft: '-0.5rem',
  } as React.CSSProperties,
  publicHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  } as React.CSSProperties,
  publicHeaderLink: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--color-primary)',
    padding: '0.25rem 0.5rem',
  } as React.CSSProperties,
  publicHeaderCta: {
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    padding: '0.45rem 1rem',
  } as React.CSSProperties,
  buyingInfoIconBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    color: 'var(--color-text-secondary)',
    transition: 'all 0.2s ease',
    marginRight: '0.25rem',
  } as React.CSSProperties,
  unreadBadge: {
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    background: 'var(--color-primary)',
    color: 'white',
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '0.15rem 0.15rem',
    borderRadius: '10px',
    minWidth: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid var(--color-bg-white)',
  } as React.CSSProperties,
  main: {
    marginLeft: '260px',
    flex: 1,
    backgroundColor: 'var(--color-bg-light)',
    height: '100dvh',
    maxHeight: '100dvh',
    transition: 'margin-left 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
  } as React.CSSProperties,
  contentWrapper: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  } as React.CSSProperties,
  content: {
    padding: '0.5rem',
    height: '100%',
    width: '100%',
    position: 'relative',
  } as React.CSSProperties,
  standardScrollContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollBehavior: 'auto',
    WebkitOverflowScrolling: 'touch',
    padding: '0 0.5rem 75px',
  } as React.CSSProperties,
  feedScrollContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollBehavior: 'auto',
    WebkitOverflowScrolling: 'touch',
    display: 'block',
    visibility: 'visible',
    opacity: 1,
    padding: '0 0.5rem 75px',
  } as React.CSSProperties,
  feedScrollContainerHidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'none',
    visibility: 'hidden',
    opacity: 0,
    pointerEvents: 'none',
    padding: '0 0.5rem 75px',
  } as React.CSSProperties,
  artworkDetailScrollContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollBehavior: 'auto',
    WebkitOverflowScrolling: 'touch',
    visibility: 'visible',
    opacity: 1,
    pointerEvents: 'auto',
    transition: 'opacity 0.2s ease-in-out',
    padding: '0 0.5rem 75px',
  } as React.CSSProperties,
  activePage: {
    visibility: 'visible',
    position: 'relative',
    pointerEvents: 'auto',
    opacity: 1,
    zIndex: 1,
    transition: 'opacity 0.2s ease-in-out',
    minHeight: '100%',
  } as React.CSSProperties,
  inactivePage: {
    visibility: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    opacity: 0,
    pointerEvents: 'none',
    zIndex: 0,
    transition: 'opacity 0.2s ease-in-out, visibility 0s linear 0.2s',
  } as React.CSSProperties,
};

export default Layout;
