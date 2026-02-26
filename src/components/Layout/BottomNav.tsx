import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AiFillHome } from 'react-icons/ai';
import { MdExplore, MdFavorite } from 'react-icons/md';
import { BiUpload } from 'react-icons/bi';
import { BsBriefcaseFill, BsPersonCircle } from 'react-icons/bs';
import { IconType } from 'react-icons';
import { useAuth } from '../../context/AuthContext';
import { canAccessRoute } from '../../utils/permissions';
import './BottomNav.css';

/**
 * BottomNav - Mobile Bottom Navigation Component
 * 
 * A modern bottom navigation bar designed for mobile views with a distinctive
 * curved center that elevates the Home icon. Matches the desktop Sidebar's
 * color scheme and design language.
 * 
 * Features:
 * - Fixed positioning at bottom of screen
 * - Curved/wave-shaped center notch
 * - 5 navigation icons: Discover, Upload, Home (center), Favorites, Cart
 * - Active state highlighting matching sidebar design
 * - Responsive and mobile-optimized
 */

interface NavItem {
  path: string;
  label: string;
  Icon: IconType;
  isCenter?: boolean;
}

const BottomNav: React.FC = () => {
  const location = useLocation();
  const { appUser } = useAuth();
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const navItemRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

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

  // Filter navigation items based on permissions
  const navItems = React.useMemo(() => {
    return allNavItems.filter(item => canAccessRoute(appUser?.role, item.path));
  }, [appUser?.role]);

  // Find the index of the active item for the wave effect
  const activeIndex = navItems.findIndex(item => isActive(item.path));

  // Update curve on active change or resize
  React.useEffect(() => {
    const handleUpdate = () => {
      setTimeout(() => forceUpdate(), 50);
    };
    
    handleUpdate();
    window.addEventListener('resize', handleUpdate);
    return () => window.removeEventListener('resize', handleUpdate);
  }, [activeIndex, location.pathname]);

  // Generate SVG path based on active item position
  const generatePath = () => {
    const containerWidth = containerRef.current?.clientWidth || 375;
    
    if (activeIndex === -1) {
      // No active item - straight line
      return `M 0,0 L ${containerWidth},0 L ${containerWidth},65 L 0,65 Z`;
    }

    // Get actual position of active icon
    const activeItem = navItems[activeIndex];
    const activeElement = navItemRefs.current[activeItem.path];
    
    let centerX: number;
    
    if (activeElement && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const itemRect = activeElement.getBoundingClientRect();
      // Calculate center of the icon relative to container
      centerX = (itemRect.left - containerRect.left) + (itemRect.width / 2);
    } else {
      // Fallback to calculated position
      const itemWidth = containerWidth / navItems.length;
      centerX = itemWidth * activeIndex + itemWidth / 2;
    }

    const curveWidth = 55; // Width of the curve on each side for wider opening
    const curveDepth = 40; // How deep the wave dips

    // Create ultra-smooth S-curve using multiple cubic Bézier curves
    const leftStart = centerX - curveWidth;
    const rightEnd = centerX + curveWidth;
    
    return `
      M 0,0 
      L ${leftStart},0 
      C ${leftStart + curveWidth * 0.2},0 ${leftStart + curveWidth * 0.4},${curveDepth * 0.3} ${leftStart + curveWidth * 0.55},${curveDepth * 0.65}
      C ${leftStart + curveWidth * 0.7},${curveDepth * 0.95} ${leftStart + curveWidth * 0.85},${curveDepth * 1.05} ${centerX},${curveDepth * 1.05}
      C ${centerX + curveWidth * 0.15},${curveDepth * 1.05} ${centerX + curveWidth * 0.3},${curveDepth * 0.95} ${centerX + curveWidth * 0.45},${curveDepth * 0.65}
      C ${centerX + curveWidth * 0.6},${curveDepth * 0.3} ${centerX + curveWidth * 0.8},0 ${rightEnd},0
      L ${containerWidth},0 
      L ${containerWidth},65 
      L 0,65 
      Z
    `;
  };

  return (
    <div className="bottom-nav-container" ref={containerRef}>
      {/* Background with dynamic wave based on active item */}
      <svg
        className="bottom-nav-curve"
        viewBox={`0 0 ${containerRef.current?.clientWidth || 375} 65`}
        preserveAspectRatio="none"
      >
        <path
          d={generatePath()}
          fill="url(#bottomNavGradient)"
        />
        <defs>
          <linearGradient id="bottomNavGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0B1F2A" />
            <stop offset="50%" stopColor="#142F3A" />
            <stop offset="100%" stopColor="#1F7F8B" />
          </linearGradient>
        </defs>
      </svg>

      {/* Navigation items container */}
      <nav className="bottom-nav-items">
        {navItems.map((item, index) => {
          const active = isActive(item.path);
          const hovered = hoveredItem === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${active ? 'active' : ''}`}
              onMouseEnter={() => setHoveredItem(item.path)}
              onMouseLeave={() => setHoveredItem(null)}
              aria-label={item.label}
              ref={(el) => {
                if (el) navItemRefs.current[item.path] = el as any;
              }}
            >
              <div className={`icon-wrapper ${active ? 'active' : ''} ${hovered && !active ? 'hovered' : ''}`}>
                <span className="nav-icon">{React.createElement(item.Icon as any)}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Decorative elements matching sidebar design */}
      <div className="bottom-nav-decorative-shapes">
        <div className="geometric-shape shape-1"></div>
        <div className="geometric-shape shape-2"></div>
      </div>
    </div>
  );
};

export default BottomNav;
