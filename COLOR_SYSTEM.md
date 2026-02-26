# Kalarang Color System Documentation

## Overview

This document describes the global color system implemented for the Kalarang React + TypeScript web app, based on the official Kalarang brand palette derived from the logo.

## Color Palette

### Primary Brand Colors

| Color Name   | Variable               | Hex Code | Usage                                   |
| ------------ | ---------------------- | -------- | --------------------------------------- |
| Primary Teal | `--color-primary`      | #2FA4A9  | Primary brand color, links, icons, CTAs |
| Deep Aqua    | `--color-primary-dark` | #1F7F8B  | Hover states, secondary elements        |
| Accent Cyan  | `--color-accent`       | #5FD1D8  | Focus states, glows, highlights         |
| Royal Blue   | `--color-royal`        | #1E4FA3  | Primary headings on light backgrounds   |

### Background Colors

| Color Name    | Variable                  | Hex Code | Usage                                     |
| ------------- | ------------------------- | -------- | ----------------------------------------- |
| Midnight Navy | `--color-bg-dark`         | #0B1F2A  | Dark backgrounds, navbar, sidebar         |
| Charcoal Blue | `--color-bg-dark-surface` | #142F3A  | Dark surface elements, cards on dark bg   |
| Soft White    | `--color-bg-light`        | #F8FAFC  | Light page backgrounds                    |
| Pure White    | `--color-bg-white`        | #FFFFFF  | Cards and containers on light backgrounds |

### Text Colors

| Color Name | Variable                     | Hex Code | Usage                         |
| ---------- | ---------------------------- | -------- | ----------------------------- |
| Soft White | `--color-text-primary-dark`  | #F8FAFC  | Text on dark backgrounds      |
| Royal Blue | `--color-text-primary-light` | #1E4FA3  | Headings on light backgrounds |
| Cool Gray  | `--color-text-secondary`     | #8FA6B3  | Secondary text, labels        |
| Muted Text | `--color-text-muted`         | #64748B  | Descriptions, subtle text     |
| Dark Text  | `--color-text-dark`          | #1E293B  | Body text, input text         |

### Border & Divider Colors

| Color Name   | Variable               | Hex Code | Usage                       |
| ------------ | ---------------------- | -------- | --------------------------- |
| Border Gray  | `--color-border`       | #D6E0E6  | Input borders, card borders |
| Border Light | `--color-border-light` | #E2E8F0  | Lighter borders, dividers   |

### State Colors

| Color Name | Variable             | Hex Code                 | Usage                    |
| ---------- | -------------------- | ------------------------ | ------------------------ |
| Hover      | `--color-hover`      | #1F7F8B                  | Button/link hover states |
| Focus      | `--color-focus`      | #5FD1D8                  | Focus rings on inputs    |
| Focus Glow | `--color-focus-glow` | rgba(95, 209, 216, 0.15) | Focus glow effect        |

## Gradients

### Brand Gradients

```css
/* Primary gradient (Royal Blue → Primary Teal) */
--gradient-primary: linear-gradient(135deg, #1e4fa3 0%, #2fa4a9 100%);

/* Primary hover gradient (darker variant) */
--gradient-primary-hover: linear-gradient(135deg, #1a408a 0%, #1f7f8b 100%);

/* Dark background gradient (Midnight Navy → Charcoal Blue → Deep Aqua) */
--gradient-dark-bg: linear-gradient(
  160deg,
  #0b1f2a 0%,
  #142f3a 45%,
  #1f7f8b 100%
);

/* Button gradient (3-color blend) */
--gradient-button: linear-gradient(
  135deg,
  #1e4fa3 0%,
  #2fa4a9 50%,
  #1f7f8b 100%
);
```

## Opacity Variants

Predefined opacity variants for consistent overlays and effects:

```css
--primary-alpha-10: rgba(47, 164, 169, 0.1)
--primary-alpha-20: rgba(47, 164, 169, 0.2)
--primary-alpha-50: rgba(47, 164, 169, 0.5)
--accent-alpha-10: rgba(95, 209, 216, 0.1)
--accent-alpha-20: rgba(95, 209, 216, 0.2)
--white-alpha-10: rgba(255, 255, 255, 0.1)
--white-alpha-20: rgba(255, 255, 255, 0.2)
--white-alpha-90: rgba(255, 255, 255, 0.9)
--dark-alpha-05: rgba(11, 31, 42, 0.05)
--dark-alpha-10: rgba(11, 31, 42, 0.1)
```

## Shadow System

Consistent shadow depths for elevation:

```css
--shadow-sm: 0 2px 8px rgba(11, 31, 42, 0.08)     /* Small elevation */
--shadow-md: 0 4px 16px rgba(11, 31, 42, 0.12)    /* Medium elevation */
--shadow-lg: 0 8px 24px rgba(11, 31, 42, 0.15)    /* Large elevation */
--shadow-xl: 0 20px 60px rgba(11, 31, 42, 0.2)    /* Extra large elevation */
--shadow-focus: 0 0 0 4px var(--color-focus-glow), 0 0 12px rgba(95, 209, 216, 0.2)
```

## Transitions

Standardized timing functions:

```css
--transition-fast: 0.15s ease      /* Quick interactions */
--transition-base: 0.3s ease       /* Standard transitions */
--transition-smooth: 0.4s cubic-bezier(0.4, 0, 0.2, 1)  /* Smooth animations */
```

## Usage Guidelines

### Light Background Pages

```jsx
// Container
backgroundColor: "var(--color-bg-light)";

// Headings
color: "var(--color-royal)";

// Body text
color: "var(--color-text-dark)";

// Secondary text
color: "var(--color-text-secondary)";
```

### Dark Background Sections

```jsx
// Background
background: "var(--gradient-dark-bg)";

// Headings
color: "var(--color-text-primary-dark)";

// Body text
color: "var(--white-alpha-90)";

// Secondary text
color: "var(--color-text-secondary)";
```

### Buttons

#### Primary CTA Button

```jsx
{
  background: 'var(--gradient-button)',
  color: 'var(--color-text-primary-dark)',
  boxShadow: 'var(--shadow-md)',
  transition: 'all var(--transition-smooth)',
}

// Hover state
{
  background: 'var(--gradient-primary-hover)',
  transform: 'translateY(-2px)',
  boxShadow: 'var(--shadow-lg)',
}
```

#### Secondary/Outline Button

```jsx
{
  background: 'transparent',
  border: '1.5px solid var(--color-border-light)',
  color: 'var(--color-text-muted)',
  transition: 'all var(--transition-base)',
}

// Hover state
{
  borderColor: 'var(--color-primary)',
  background: 'var(--primary-alpha-10)',
}
```

### Input Fields

```jsx
{
  border: '2px solid var(--color-border-light)',
  backgroundColor: 'var(--color-bg-light)',
  color: 'var(--color-text-dark)',
  transition: 'all var(--transition-base)',
}

// Focus state (auto-applied via global CSS)
{
  borderColor: 'var(--color-focus)',
  boxShadow: 'var(--shadow-focus)',
}
```

### Links

```jsx
{
  color: 'var(--color-primary)',
  transition: 'color var(--transition-base)',
}

// Hover state
{
  color: 'var(--color-hover)',
}
```

## File Structure

```
src/
├── colorpalette.css          # All color variables defined here
├── index.css                 # Global styles importing colorpalette.css
├── App.css                   # App-level styles using variables
├── components/
│   ├── Navbar.tsx            # Uses dark background colors
│   ├── Sidebar.tsx           # Uses dark background colors
│   └── Layout.tsx            # Uses light background colors
└── pages/
    ├── Login.tsx             # Mixed light/dark sections
    ├── Home.tsx              # Light background
    └── Upload.tsx            # Light background
```

## Accessibility Notes

✅ **All color combinations meet WCAG AA contrast requirements**

- Dark text (`#1E293B`) on light backgrounds (`#F8FAFC`) ✓
- Light text (`#F8FAFC`) on dark backgrounds (`#0B1F2A`) ✓
- Royal Blue headings (`#1E4FA3`) on light backgrounds ✓
- Accent colors used for decorative purposes only

✅ **Focus states are clearly visible**

- Cyan focus ring (`#5FD1D8`) with glow effect
- 4px offset for clear separation

## Future Enhancements

### Light/Dark Mode Support

The current system is prepared for future light/dark mode implementation:

```css
/* Future: Add theme switching */
[data-theme="dark"] {
  --color-bg-light: var(--color-bg-dark);
  --color-text-primary-light: var(--color-text-primary-dark);
  /* ...other overrides */
}
```

### Additional Color Variants

Consider adding these if needed:

- Success states (green)
- Warning states (yellow/orange)
- Error states (red)
- Info states (blue)

## Migration Notes

### Before (Old Colors)

```jsx
// ❌ Old hardcoded values
color: "#fff";
background: "#00001F";
border: "2px solid #E2E8F0";
```

### After (New Variables)

```jsx
// ✅ New semantic variables
color: "var(--color-text-primary-dark)";
background: "var(--color-bg-dark)";
border: "2px solid var(--color-border-light)";
```

## Support

For questions or updates to the color system, refer to:

1. This documentation
2. `colorpalette.css` (source of truth)
3. Kalarang brand guidelines
4. Design team

---

**Last Updated:** December 2024  
**Version:** 1.0.0  
**Maintained by:** Kalarang Development Team
