# BottomNav Visual Design Reference

## Layout Structure

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              Main Content Area                  │
│         (Your page content here)                │
│                                                 │
│                                                 │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│     🔍      📤      🏠      ❤️      🛒         │  <- Icons
│  Discover  Post  [HOME]  Favs   Cart           │
│                    ⬆️                           │  <- Center icon elevated
│          ╱────────╲  ╱────────╲                │  <- Curved notch
│  ╱──────────────────────────────────────╲      │
│ │                                        │     │  <- Gradient background
│ │     Teal (#2FA4A9) to Aqua (#1F7F8B)  │     │
│ │                                        │     │
└──────────────────────────────────────────────────┘
```

## Color Scheme (Matches Desktop Sidebar)

### Background Gradient
- Start: `#0B1F2A` (Midnight Navy)
- Middle: `#142F3A` (Charcoal Blue)
- End: `#1F7F8B` (Deep Aqua)

### Icon States

#### Inactive Icons
- Background: `rgba(255, 255, 255, 0.05)` (subtle transparent)
- Icon Color: `#8FA6B3` (Cool Gray)
- Size: 40px × 40px
- Border Radius: 10px

#### Active Icons
- Background: `linear-gradient(135deg, #2FA4A9 0%, #5FD1D8 100%)`
- Icon Color: `#F8FAFC` (Soft White)
- Glow: `0 4px 12px rgba(47, 164, 169, 0.4)`
- Extra Glow: `0 0 20px rgba(95, 209, 216, 0.2)`

#### Center Icon (Home - Special)
- Size: 56px × 56px (larger)
- Border Radius: 50% (fully round)
- Position: Elevated -35px above baseline
- Border: 3px solid rgba(11, 31, 42, 0.5)
- Enhanced shadow when active

#### Hover State
- Background: `rgba(95, 209, 216, 0.15)`
- Transform: `translateY(-2px)` (slight lift)

## Icon Mapping

| Position | Icon | Path | Package |
|----------|------|------|---------|
| 1 (Left) | MdExplore | /discover | react-icons/md |
| 2 | BiUpload | /post | react-icons/bi |
| 3 (Center) | AiFillHome | /home | react-icons/ai |
| 4 | MdFavorite | /favourites | react-icons/md |
| 5 (Right) | MdShoppingCart | /cart | react-icons/md |

## Dimensions

- **Total Height**: 65px
- **Width**: 100% of screen
- **Icon Size (Regular)**: 40px × 40px
- **Icon Size (Center)**: 56px × 56px
- **Font Size (Icons)**: 1.25rem (regular), 1.5rem (center)
- **Label Font Size**: 0.65rem
- **Spacing**: `space-around` (flexbox)

## Curve/Wave Specifications

The center curve is created using SVG path:
- **ViewBox**: `0 0 375 65`
- **Curve Depth**: Goes up to -5px at center (creates notch)
- **Curve Width**: ~80px (from x=140 to x=235)
- **Smooth Bezier**: Uses quadratic curves (Q commands)

### SVG Path Breakdown
```
M 0,20           → Start left edge at y=20
L 140,20         → Straight line to start of curve
Q 150,20 155,10  → Curve begins, rising up
Q 187.5,-5 220,10 → Center peak at -5px
Q 225,20 235,20  → Curve descends
L 375,20         → Straight line to right edge
L 375,65 L 0,65 Z → Complete rectangle below
```

## Decorative Elements

### Floating Shapes
- **Shape 1** (Left): 40px circle, teal glow, top-left position
- **Shape 2** (Right): 30px circle, cyan glow, top-right position
- **Animation**: Float up/down with rotation (6s loop)

### Gradient Overlay
- Top edge subtle glow line
- Color: `rgba(95, 209, 216, 0.3)`
- Blur: 8px

## Responsive Breakpoints

| Screen Size | Behavior |
|------------|----------|
| ≤375px | Smaller icons (36px/52px), compact spacing |
| 376-768px | Normal size (40px/56px), standard spacing |
| >768px | **Hidden** (Desktop sidebar shown instead) |

## Safe Area Support
- Bottom padding respects iPhone notches
- Uses `env(safe-area-inset-bottom)`
- Minimum padding: 75px

## Animation Details

### Float Animation (Decorative Shapes)
```
0%: translateY(0) rotate(0deg)
25%: translateY(-10px) rotate(5deg)
50%: translateY(-5px) rotate(-5deg)
75%: translateY(-12px) rotate(3deg)
100%: translateY(0) rotate(0deg)
```
Duration: 6s ease-in-out infinite

### Icon Transitions
- All states: `transition: all 0.3s ease`
- Hover lift: `translateY(-2px)`
- Center hover: `translateY(-4px) scale(1.05)`
- Active press: `scale(0.95)`

## Shadow System

### Container Shadow
```css
filter: drop-shadow(0 -4px 24px rgba(0, 0, 0, 0.3))
```

### Active Icon Shadow (Regular)
```css
box-shadow: 
  0 4px 12px rgba(47, 164, 169, 0.4),
  0 0 20px rgba(95, 209, 216, 0.2)
```

### Active Icon Shadow (Center)
```css
box-shadow:
  0 6px 20px rgba(47, 164, 169, 0.5),
  0 0 30px rgba(95, 209, 216, 0.3),
  inset 0 1px 0 rgba(255, 255, 255, 0.2)
```

## Accessibility Features
- ARIA labels on all nav items
- Keyboard focus visible (2px accent outline)
- Touch targets: 48px minimum (iOS/Android standard)
- High contrast active states
- Screen reader friendly navigation

## Z-Index Layering
```
Container: 999
SVG Background: absolute, bottom: 0
Nav Items: z-index: 1 (above background)
Decorative Shapes: z-index: 0 (behind items)
```
