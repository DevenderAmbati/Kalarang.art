import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AiFillHome } from 'react-icons/ai';
import { MdExplore, MdFavorite, MdChevronRight } from 'react-icons/md';
import { BiUpload } from 'react-icons/bi';
import { BsBriefcaseFill, BsPersonCircle } from 'react-icons/bs';
import { IconType } from 'react-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { canAccessRoute } from '../../utils/permissions';
import './CollapsedSidebar.css';

/**
 * CollapsedSidebar - Vertical Navigation Component
 * 
 * A modern vertical sidebar designed with a curved notch effect
 * similar to the bottom navigation bar. The active menu item moves
 * rightwards with a smooth curved left edge.
 * 
 * Features:
 * - Fixed positioning on left side of screen
 * - Curved/wave-shaped notch for active item
 * - 6 navigation icons including expand button
 * - Active state highlighting with rightward movement
 * - Responsive and desktop-optimized
 */

interface NavItem {
  path: string;
  label: string;
  Icon: IconType;
}

interface CollapsedSidebarProps {
  onExpand: () => void;
}

const CollapsedSidebar: React.FC<CollapsedSidebarProps> = ({ onExpand }) => {
  const location = useLocation();
  const { appUser } = useAuth();
  const { theme } = useTheme();
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const iconWrapperRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Check if a path is currently active
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

  // All navigation items
  const allNavItems: NavItem[] = [
    { path: '/home', label: 'Home', Icon: AiFillHome },
    { path: '/discover', label: 'Discover', Icon: MdExplore },
    { path: '/post', label: 'Post', Icon: BiUpload },
    { path: '/favourites', label: 'Favourites', Icon: MdFavorite },
    { path: '/portfolio', label: 'Portfolio', Icon: BsBriefcaseFill },
    { path: '/profile', label: 'Profile', Icon: BsPersonCircle },
  ];

  // Filter menu items based on permissions
  const menuItems = React.useMemo(() => {
    return allNavItems.filter((item: NavItem) => canAccessRoute(appUser?.role, item.path));
  }, [appUser?.role]);

  // Find the index of the active item for the wave effect
  const activeIndex = menuItems.findIndex((item: NavItem) => isActive(item.path));

  // Force update when active item changes or component mounts
  React.useEffect(() => {
    // Use setTimeout to ensure refs are populated and CSS is applied
    const timer = setTimeout(() => {
      forceUpdate();
    }, 50);
    return () => clearTimeout(timer);
  }, [activeIndex, location.pathname]);

  React.useEffect(() => {
    // Also update on mount and when window resizes
    const handleResize = () => {
      setTimeout(() => forceUpdate(), 50);
    };
    window.addEventListener('resize', handleResize);
    
    // Initial update after a short delay
    const timer = setTimeout(() => forceUpdate(), 100);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  // Generate SVG path based on active item position
  const generatePath = () => {
    const containerHeight = containerRef.current?.clientHeight || window.innerHeight;
    
    if (activeIndex === -1) {
      // No active item - straight line
      return "M 0,0 L 80,0 L 80,100 L 0,100 Z";
    }

    // Get actual position of active icon
    const activeItem = menuItems[activeIndex];
    const activeElement = iconWrapperRefs.current[activeItem.path];
    
    let centerY: number;
    
    if (activeElement && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const itemRect = activeElement.getBoundingClientRect();
      // Calculate center of the icon relative to container
      const centerPx = (itemRect.top - containerRect.top) + (itemRect.height / 2);
      // Convert to viewBox percentage (0-100)
      centerY = (centerPx / containerHeight) * 100;
    } else {
      // Fallback calculation
      const logoHeight = 100;
      const totalItemHeight = 64;
      const gap = 5;
      const itemPadding = 12;
      const iconHeight = 40;
      const afterExpandButton = logoHeight + totalItemHeight + gap;
      const itemCenterPx = afterExpandButton + (activeIndex * (totalItemHeight + gap)) + itemPadding + (iconHeight / 2);
      centerY = (itemCenterPx / containerHeight) * 100;
    }
    
    const curveHeightPercent = 7; // Height of the curve on each side
    const curveDepth = 50; // How deep the wave extends to the right

    const topStart = centerY - curveHeightPercent;
    const bottomEnd = centerY + curveHeightPercent;
    
    return `
      M 0,0 
      L 80,0
      L 80,${topStart}
      C 80,${topStart + curveHeightPercent * 0.2} ${80 - curveDepth * 0.3},${topStart + curveHeightPercent * 0.4} ${80 - curveDepth * 0.65},${topStart + curveHeightPercent * 0.55}
      C ${80 - curveDepth * 0.95},${topStart + curveHeightPercent * 0.7} ${80 - curveDepth * 1.05},${topStart + curveHeightPercent * 0.85} ${80 - curveDepth * 1.05},${centerY}
      C ${80 - curveDepth * 1.05},${centerY + curveHeightPercent * 0.15} ${80 - curveDepth * 0.95},${centerY + curveHeightPercent * 0.3} ${80 - curveDepth * 0.65},${centerY + curveHeightPercent * 0.45}
      C ${80 - curveDepth * 0.3},${centerY + curveHeightPercent * 0.6} 80,${centerY + curveHeightPercent * 0.8} 80,${bottomEnd}
      L 80,100 
      L 0,100 
      Z
    `;
  };

  return (
    <div className="collapsed-sidebar-container" ref={containerRef}>
      {/* Background with dynamic wave based on active item */}
      <svg
        className="collapsed-sidebar-curve"
        viewBox="0 0 80 100"
        preserveAspectRatio="none"
      >
        <path
          d={generatePath()}
          fill="url(#collapsedSidebarGradient)"
          style={{ transition: 'd 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        />
        <defs>
          <linearGradient id="collapsedSidebarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            {theme === 'light' ? (
              <>
                <stop offset="0%" stopColor="#0B1F2A" />
                <stop offset="50%" stopColor="#142F3A" />
                <stop offset="100%" stopColor="#1F7F8B" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#0F172A" />
                <stop offset="50%" stopColor="#1E293B" />
                <stop offset="100%" stopColor="#334155" />
              </>
            )}
          </linearGradient>
        </defs>
      </svg>

      {/* Logo at top */}
      <div className="collapsed-sidebar-logo">
        <img 
          src="/logo%20top.png" 
          alt="Kalarang Logo" 
          className="collapsed-logo-img"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Navigation items container */}
      <nav className="collapsed-sidebar-items">
        {/* Expand button */}
        <div
          className="sidebar-nav-item expand-item"
          onClick={onExpand}
          onMouseEnter={() => setHoveredItem('expand')}
          onMouseLeave={() => setHoveredItem(null)}
          aria-label="Expand sidebar"
        >
          <div className={`sidebar-icon-wrapper ${hoveredItem === 'expand' ? 'hovered' : ''}`}>
            <span className="sidebar-nav-icon">{React.createElement(MdChevronRight as any)}</span>
          </div>
        </div>

        {menuItems.map((item: NavItem, index: number) => {
          const active = isActive(item.path);
          const hovered = hoveredItem === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-nav-item ${active ? 'active' : ''}`}
              onMouseEnter={() => setHoveredItem(item.path)}
              onMouseLeave={() => setHoveredItem(null)}
              aria-label={item.label}
            >
              <div 
                className={`sidebar-icon-wrapper ${active ? 'active' : ''} ${hovered && !active ? 'hovered' : ''}`}
                ref={(el: HTMLDivElement | null) => { iconWrapperRefs.current[item.path] = el; }}
              >
                <span className="sidebar-nav-icon">{React.createElement(item.Icon as any)}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Decorative elements matching sidebar design */}
      <div className="collapsed-sidebar-decorative-shapes">
        <div className="sidebar-geometric-shape sidebar-shape-1"></div>
        <div className="sidebar-geometric-shape sidebar-shape-2"></div>
      </div>
    </div>
  );
};

export default CollapsedSidebar;
