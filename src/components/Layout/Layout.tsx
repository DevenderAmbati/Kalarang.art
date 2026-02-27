import React, { useState, useEffect } from 'react';
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
import { subscribeToUnreadCount } from '../../services/notificationService';
import { useChatContext } from '../../context/ChatContext';
import './Layout.css';

interface LayoutProps {
  children?: React.ReactNode;
  onLogout: () => void;
  pageTitle?: string;
  // New props for persistent mounting
  homeFeedComponent?: React.ReactNode;
  discoverComponent?: React.ReactNode;
  favouritesComponent?: React.ReactNode;
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
  favouritesComponent
}) => {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [, forceUpdate] = useState({});
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const { unreadCount: unreadChatCount } = useChatContext();

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
    navigate('/profile');
  };

  // Detect which route is active
  const isHomeFeedActive = location.pathname === '/home';
  const isDiscoverActive = location.pathname === '/discover';
  const isFavouritesActive = location.pathname === '/favourites';
  const isArtworkDetail = location.pathname.startsWith('/card/');
  const isOtherUserPortfolio = location.pathname.startsWith('/portfolio/') && location.pathname !== '/portfolio';
  
  // Determine if we're in persistent mounting mode (feed pages)
  const isPersistentMode = homeFeedComponent && discoverComponent && favouritesComponent;
  
  // Show persistent pages for /home, /discover, /favourites, and when viewing artwork detail or other user portfolio
  const showPersistentPages = isPersistentMode && (isHomeFeedActive || isDiscoverActive || isFavouritesActive || isArtworkDetail || isOtherUserPortfolio);

  // Determine page title based on route
  const getPageTitle = () => {
    if (isHomeFeedActive) return 'Home';
    if (isDiscoverActive) return 'Discover';
    if (isFavouritesActive) return 'Favourites';
    if (isArtworkDetail) return 'Artwork';
    if (location.pathname === '/portfolio') return 'Portfolio';
    if (location.pathname.startsWith('/portfolio/')) {
      // Extract first name from document title if available
      const titleMatch = document.title.match(/^(.+?)'s Portfolio/);
      return titleMatch ? `${titleMatch[1]}'s Portfolio` : 'Portfolio';
    }
    if (location.pathname === '/profile') return 'Profile';
    return pageTitle;
  };
  
  return (
    <div style={styles.container}>
      {isCollapsed ? (
        <CollapsedSidebar onExpand={toggleSidebar} />
      ) : (
        <Sidebar onLogout={onLogout} />
      )}
      <main 
        className="layout-main-content"
        style={{
          ...styles.main,
          marginLeft: isCollapsed ? '80px' : '260px',
        }}
      >
        {/* Header with Page Title */}
        <div className="layout-header" style={styles.header}>
          <div className="header-left" style={styles.headerLeft}>
            <h1 style={styles.pageTitle}>{getPageTitle()}</h1>
          </div>
          <div className="header-right" style={styles.headerRight}>
            {appUser && (
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
            )}
            {appUser?.role === 'artist' && (
              <>
                <div 
                  onClick={() => setIsNotificationModalOpen(true)}
                  style={{...styles.notificationIcon, position: 'relative'}} 
                  className="layout-notification-icon"
                >
                  {IoMdNotifications({ size: 28 })}
                  {unreadCount > 0 && (
                    <div style={styles.unreadBadge}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}
                </div>
                <div onClick={handleProfileClick} style={styles.profileIcon} className="layout-profile-icon">
                  <img src={appUser.avatar || '/artist.png'} alt="Artist Profile" style={styles.profileImage} />
                </div>
              </>
            )}
          </div>
        </div>
        <div style={styles.contentWrapper}>
          {showPersistentPages ? (
            <>
              {/* HomeFeed - Independent scroll container */}
              <div style={isHomeFeedActive && !isArtworkDetail && !isOtherUserPortfolio ? styles.feedScrollContainer : styles.feedScrollContainerHidden}>
                {homeFeedComponent}
              </div>
              
              {/* Discover - Independent scroll container */}
              <div style={isDiscoverActive && !isArtworkDetail && !isOtherUserPortfolio ? styles.feedScrollContainer : styles.feedScrollContainerHidden}>
                {discoverComponent}
              </div>
              
              {/* Favourites - Independent scroll container */}
              <div style={isFavouritesActive && !isArtworkDetail && !isOtherUserPortfolio ? styles.feedScrollContainer : styles.feedScrollContainerHidden}>
                {favouritesComponent}
              </div>
              
              {/* ArtworkDetail - Independent scroll container */}
              {isArtworkDetail && (
                <div style={styles.artworkDetailScrollContainer}>
                  {children}
                </div>
              )}
              
              {/* OtherUserPortfolio - Independent scroll container */}
              {isOtherUserPortfolio && (
                <div style={styles.artworkDetailScrollContainer}>
                  {children}
                </div>
              )}
            </>
          ) : (
            <div style={styles.standardScrollContainer}>
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
      </main>
      {/* Mobile Bottom Navigation - Only visible on mobile devices */}
      <BottomNav />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5em',
    background: 'linear-gradient(90deg, #E8F4F5 0%, #c1f8fdff 100%)',
    borderBottom: '1px solid rgba(47, 164, 169, 0.2)',
    boxShadow: '0 4px 16px rgba(47, 164, 169, 0.15)',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
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
    fontSize: '1.35rem',
    fontWeight: 700,
    color: 'var(--color-text-primary-light)',
    fontFamily: '"Poppins", "Segoe UI", "Roboto", sans-serif',
    letterSpacing: '0px',
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
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    transition: 'all 0.3s ease',
    marginRight: '0.5rem',
    marginLeft: '-0.5rem',
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
    scrollBehavior: 'smooth',
    WebkitOverflowScrolling: 'touch',
    padding: '72px 0.5rem 75px',
  } as React.CSSProperties,
  feedScrollContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollBehavior: 'smooth',
    WebkitOverflowScrolling: 'touch',
    visibility: 'visible',
    opacity: 1,
    transition: 'opacity 0.2s ease-in-out',
    padding: '72px 0.5rem 75px',
  } as React.CSSProperties,
  feedScrollContainerHidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    visibility: 'hidden',
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 0.2s ease-in-out, visibility 0s linear 0.2s',
    padding: '72px 0.5rem 75px',
  } as React.CSSProperties,
  artworkDetailScrollContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollBehavior: 'smooth',
    WebkitOverflowScrolling: 'touch',
    visibility: 'visible',
    opacity: 1,
    pointerEvents: 'auto',
    transition: 'opacity 0.2s ease-in-out',
    padding: '72px 0.5rem 75px',
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
