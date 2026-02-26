# Mobile Bottom Navigation - BottomNav Component

## Overview
A modern, mobile-optimized bottom navigation bar for the Kalarang application that matches the desktop Sidebar's design language and color scheme.

## Features

### Design Features
- **Curved Center Design**: Unique wave-shaped notch in the center that elevates the Home icon
- **Color Scheme**: Matches desktop Sidebar with gradient background (`#0B1F2A` → `#142F3A` → `#1F7F8B`)
- **Icon System**: Uses the same react-icons as the desktop Sidebar
- **Responsive**: Automatically shows on mobile (≤768px) and hides on desktop
- **Smooth Animations**: Floating decorative elements and smooth transitions

### Navigation Items
1. **Discover** (Left) - Explore artworks
2. **Post** (Left-Center) - Upload new content  
3. **Home** (Center - Elevated) - Main dashboard
4. **Favourites** (Right-Center) - Saved items
5. **Cart** (Right) - Shopping cart

## Implementation

### Files Created
- `src/components/BottomNav.tsx` - Main component
- `src/components/BottomNav.css` - Component styles
- `src/components/Layout.css` - Responsive layout styles

### Integration
The BottomNav is already integrated into the Layout component:

\`\`\`tsx
import Layout from './components/Layout';

// The Layout automatically includes BottomNav
<Layout onLogout={handleLogout}>
  {children}
</Layout>
\`\`\`

### Responsive Behavior

#### Mobile View (≤768px)
- Desktop Sidebar is hidden
- BottomNav appears at bottom of screen
- Main content has no left margin
- Bottom padding added to prevent content overlap

#### Desktop View (>768px)  
- Desktop Sidebar is visible
- BottomNav is hidden
- Main content has left margin for sidebar
- No bottom padding needed

## Customization

### Adding/Removing Icons
Edit the `navItems` array in `BottomNav.tsx`:

\`\`\`tsx
const navItems: NavItem[] = [
  { path: '/discover', label: 'Discover', Icon: MdExplore },
  { path: '/post', label: 'Post', Icon: BiUpload },
  { path: '/home', label: 'Home', Icon: AiFillHome, isCenter: true },
  { path: '/favourites', label: 'Favourites', Icon: MdFavorite },
  { path: '/cart', label: 'Cart', Icon: MdShoppingCart },
];
\`\`\`

**Note**: Keep `isCenter: true` on exactly one item for the elevated center button.

### Adjusting Colors
Colors inherit from `src/colorpalette.css` CSS variables:
- `--color-primary`: `#2FA4A9` (Primary Teal)
- `--color-accent`: `#5FD1D8` (Accent Cyan)
- `--color-text-secondary`: `#8FA6B3` (Cool Gray)
- `--color-text-primary-dark`: `#F8FAFC` (Soft White)

### Customizing the Curve
The curve is defined by an SVG path in `BottomNav.tsx`. Adjust the path coordinates:

\`\`\`tsx
<path
  d="M 0,20 
     L 140,20          // Left flat section
     Q 150,20 155,10   // Left curve start
     Q 187.5,-5 220,10 // Center curve (goes up)
     Q 225,20 235,20   // Right curve start  
     L 375,20          // Right flat section
     L 375,65 L 0,65 Z"
/>
\`\`\`

## Accessibility

### Keyboard Navigation
- All nav items support keyboard focus
- Visible focus indicators with `--color-focus`

### Screen Readers
- Each icon has an `aria-label` with descriptive text
- Semantic HTML with `<nav>` element

### Touch Optimization
- Large touch targets (40px icons, 56px for center)
- Prevents text selection on touch
- Active/touch feedback animations

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS Grid and Flexbox support required
- SVG support required for curved background
- Works on iOS Safari (includes safe-area support)

## Performance Considerations
- CSS animations use `transform` for hardware acceleration
- Fixed positioning with `will-change` for smooth scrolling
- Minimal JavaScript (only for active state detection)

## Known Limitations
1. **Center Icon**: Only supports one center icon at a time
2. **Max Icons**: Designed for 5 icons (can add more but may require layout adjustments)
3. **Tablet**: Shows mobile view on tablets <768px

## Future Enhancements
- Add badge notifications (e.g., cart count)
- Add haptic feedback on touch devices
- Support for icon-only mode (hide labels)
- Theme switching support (dark/light mode toggle)

## Troubleshooting

### Bottom Nav Not Showing
1. Check screen width is ≤768px
2. Verify BottomNav is imported in Layout.tsx
3. Check CSS is loaded (inspect element)

### Content Hidden Behind Nav
1. Ensure Layout.css is imported
2. Check `.layout-main-content` has bottom padding
3. Verify `paddingBottom: 75px` in styles

### Icons Not Displaying
1. Verify react-icons is installed: `npm install react-icons`
2. Check icon imports in BottomNav.tsx
3. Ensure icon components are correctly referenced

### Curve Not Rendering
1. Check browser SVG support
2. Inspect SVG path coordinates
3. Verify viewBox matches SVG dimensions

## Dependencies
- `react` and `react-dom`
- `react-router-dom` (for navigation)
- `react-icons` (for icon components)

## Code Example

### Standalone Usage (if needed outside Layout)
\`\`\`tsx
import BottomNav from './components/BottomNav';

function MobilePage() {
  return (
    <div>
      <div className="content">
        {/* Your page content */}
      </div>
      <BottomNav />
    </div>
  );
}
\`\`\`

### Custom Styling
\`\`\`css
/* Override bottom nav height */
.bottom-nav-container {
  height: 70px !important;
}

/* Change center icon size */
.icon-wrapper-center {
  width: 60px !important;
  height: 60px !important;
}
\`\`\`

## Contact & Support
For issues or feature requests, refer to the main Kalarang project documentation.
