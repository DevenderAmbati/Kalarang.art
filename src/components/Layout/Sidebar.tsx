import React, { CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AiFillHome } from 'react-icons/ai';
import { MdExplore, MdFavorite, MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { BiUpload } from 'react-icons/bi';
import { BsBriefcaseFill, BsPersonCircle } from 'react-icons/bs';
import { IconType } from 'react-icons';
import { useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import { canAccessRoute } from '../../utils/permissions';

// Add keyframes animation
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes float {
    0%, 100% {
      transform: translateY(0px) rotate(0deg);
    }
    25% {
      transform: translateY(-15px) rotate(5deg);
    }
    50% {
      transform: translateY(-10px) rotate(-5deg);
    }
    75% {
      transform: translateY(-20px) rotate(3deg);
    }
  }
`;
if (!document.head.querySelector('[data-sidebar-animations]')) {
  styleSheet.setAttribute('data-sidebar-animations', 'true');
  document.head.appendChild(styleSheet);
}

interface SidebarProps {
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const { isCollapsed, toggleSidebar } = useSidebar();

  const isActive = (path: string) => {
    // Direct path match
    if (location.pathname === path) return true;
    
    // Check if viewing other user's portfolio or artwork detail - preserve source route
    if (location.pathname.startsWith('/portfolio/') || location.pathname.startsWith('/card/')) {
      const sourceRoute = sessionStorage.getItem('artworkSourceRoute');
      return sourceRoute === path;
    }
    
    return false;
  };

  // All menu items
  const allMenuItems: Array<{ path: string; label: string; Icon: IconType }> = [
    { path: '/home', label: 'Home', Icon: AiFillHome },
    { path: '/discover', label: 'Discover', Icon: MdExplore },
    { path: '/post', label: 'Post', Icon: BiUpload },
    { path: '/favourites', label: 'Favourites', Icon: MdFavorite },
    { path: '/portfolio', label: 'Portfolio', Icon: BsBriefcaseFill },
    { path: '/profile', label: 'Profile', Icon: BsPersonCircle },
  ];

  // Filter menu items based on permissions
  const menuItems = React.useMemo(() => {
    return allMenuItems.filter(item => canAccessRoute(appUser?.role, item.path));
  }, [appUser?.role]);

  return (
    <div 
      className="sidebar-container"
      style={{
        ...styles.sidebar,
        width: isCollapsed ? '80px' : '260px',
      }}
    >
      {/* Decorative gradient overlay */}
      <div style={styles.gradientOverlay}></div>
      
      {/* Animated geometric shapes */}
      <div style={styles.geometricShape1}></div>
      <div style={styles.geometricShape2}></div>
      <div style={styles.geometricShape3}></div>
      
      {/* Toggle button */}
      {!isCollapsed && (
        <button
          onClick={toggleSidebar}
          style={styles.toggleButton}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? React.createElement(MdChevronRight as any) : React.createElement(MdChevronLeft as any)}
        </button>
      )}
      
      <div >
        <div style={styles.logoContainer}>
          <img 
            src="/logo%20top.png" 
            alt="Kalarang Logo" 
            style={{
              ...styles.logo,
              ...(isCollapsed ? styles.logoCollapsed : {}),
            }}
            onError={(e) => {
              console.log('Logo top.png failed to load');
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {!isCollapsed && (
            <img 
              src="/test%20top.png" 
              alt="Kalarang Test" 
              style={styles.testLogo}
              onError={(e) => {
                console.log('Test top.png failed to load');
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
        </div>
        <div style={styles.headerLine}>
          <div style={styles.decorativeLine}></div>
        </div>
      </div>

      <nav style={{
        ...styles.nav,
        ...(isCollapsed ? { paddingTop: '0rem' } : {paddingTop: '2.5rem'})
      }}>
        {isCollapsed && (
          <div
            onClick={toggleSidebar}
            onMouseEnter={() => setHoveredItem('expand')}
            onMouseLeave={() => setHoveredItem(null)}
            style={styles.expandButtonWrapper}
          >
            <div style={{
              ...styles.iconWrapper,
              ...(hoveredItem === 'expand' ? styles.iconWrapperHover : {}),
            }}>
              <span style={styles.icon}>
                {React.createElement(MdChevronRight as any)}
              </span>
            </div>
          </div>
        )}
        {menuItems.map((item) => {
          const active = isActive(item.path);
          const hovered = hoveredItem === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onMouseEnter={() => setHoveredItem(item.path)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                ...styles.navItem,
                ...(active ? styles.navItemActive : {}),
                ...(hovered && !active ? styles.navItemHover : {}),
                ...(isCollapsed ? { padding: '0rem' } : {}),
              }}
            >
              <div style={{
                ...styles.iconWrapper,
                ...(active ? styles.iconWrapperActive : {}),
                ...(hovered && !active ? styles.iconWrapperHover : {}),
              }}>
                <span style={styles.icon}>{React.createElement(item.Icon as any)}</span>
              </div>
              {!isCollapsed && <span style={styles.label}>{item.label}</span>}
              {active && !isCollapsed && <div style={styles.activeIndicator}></div>}
            </Link>
          );
        })}
      </nav>

      {/* Decorative bottom element */}
      <div style={styles.footer}>
        <div style={styles.decorativeLine}></div>
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  sidebar: {
    width: '260px',
    height: '100vh',
    background: 'var(--sidebar-bg)',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    left: 0,
    top: 0,
    boxShadow: 'var(--sidebar-shadow)',
    zIndex: 1000,
    transition: 'width 0.3s ease, background 0.3s ease',
  },
  toggleButton: {
    position: 'absolute',
    right: '-15px',
    top: '105px',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
    border: 'none',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '1.2rem',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    zIndex: 1001,
    transition: 'all 0.3s ease',
  },
  header: {
    padding: '2rem 1.5rem 1.5rem',
    borderBottom: '1px solid var(--sidebar-border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    position: 'relative',
    zIndex: 1,
  },
  logoContainer: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0',
    padding: '2px',
    borderRadius: '12px',
  },
  logo: {
    height: '60px',
    width: 'auto',
    objectFit: 'contain',
    maxWidth: '50%',
    marginLeft: '-15px',
    marginRight: '-35px',
    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
  },
  logoCollapsed: {
    width: '80px',
    height: 'auto',
    maxWidth: 'none',
    marginRight: '0',
    marginTop: '10px',
  },
  testLogo: {
    height: '100px',
    width: 'auto',
    objectFit: 'contain',
    maxWidth: '85%',
    marginLeft: '-40px',
    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
    transform: 'translateY(10px)',
  },
  brandText: {
    fontSize: '0.875rem',
    fontWeight: '700',
    letterSpacing: '2px',
    color: 'var(--color-primary)',
    textAlign: 'center',
    textShadow: '0 0 10px rgba(47, 164, 169, 0.3)',
  },
  nav: {
    flex: 1,
    padding: '1rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    position: 'relative',
    zIndex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '0.875rem 1.25rem',
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    fontSize: '0.95rem',
    fontWeight: '500',
    borderRadius: '12px',
    position: 'relative',
    overflow: 'hidden',
    minHeight: '56px',
  },
  navItemActive: {
    background: 'linear-gradient(90deg, rgba(47, 164, 169, 0.15) 0%, rgba(95, 209, 216, 0.08) 100%)',
    color: 'var(--color-text-primary-dark)',
  },
  navItemHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--color-text-primary-dark)',
  },
  iconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.05)',
    flexShrink: 0,
  },
  iconWrapperActive: {
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
    boxShadow: '0 4px 12px rgba(47, 164, 169, 0.4), 0 0 20px rgba(95, 209, 216, 0.2)',
  },
  iconWrapperHover: {
    background: 'rgba(95, 209, 216, 0.15)',
  },
  icon: {
    fontSize: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  label: {
    flex: 1,
    fontWeight: '500',
  },
  expandButtonWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '0',
    color: 'var(--color-text-secondary)',
    borderRadius: '12px',
    minHeight: '56px',
    cursor: 'pointer',
    marginTop: '1rem',
    transition: 'background-color 0.3s ease',
  },
  activeIndicator: {
    width: '4px',
    height: '24px',
    borderRadius: '2px',
    background: 'linear-gradient(180deg, var(--color-primary) 0%, var(--color-accent) 100%)',
    boxShadow: '0 0 8px rgba(95, 209, 216, 0.6)',
    position: 'absolute',
    right: '8px',
  },
  footer: {
    padding: '1.5rem',
    position: 'relative',
    zIndex: 1,
  },
  headerLine: {
    padding: '1rem 1.5rem 0',
    position: 'relative',
    zIndex: 1,
  },
  decorativeLine: {
    height: '3px',
    borderRadius: '2px',
    background: 'linear-gradient(90deg, transparent 0%, var(--color-primary) 50%, transparent 100%)',
    boxShadow: '0 0 8px rgba(47, 164, 169, 0.5)',
  },
};

export default Sidebar;
