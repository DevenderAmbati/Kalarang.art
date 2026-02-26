# Kalarang Color System - Quick Reference

## 🎨 Quick Color Reference

### Common Use Cases

#### 1. Light Page Background

```jsx
backgroundColor: "var(--color-bg-light)"; // #F8FAFC
```

#### 2. Card/Container on Light Background

```jsx
backgroundColor: "var(--color-bg-white)"; // #FFFFFF
boxShadow: "var(--shadow-sm)";
```

#### 3. Dark Section (Hero, Navbar, Sidebar)

```jsx
background: "var(--color-bg-dark)"; // #0B1F2A
// OR for gradients:
background: "var(--gradient-dark-bg)";
```

#### 4. Heading on Light Background

```jsx
color: "var(--color-royal)"; // #1E4FA3
```

#### 5. Heading on Dark Background

```jsx
color: "var(--color-text-primary-dark)"; // #F8FAFC
```

#### 6. Body Text (Light Background)

```jsx
color: "var(--color-text-dark)"; // #1E293B
```

#### 7. Secondary/Muted Text

```jsx
color: "var(--color-text-secondary)"; // #8FA6B3
// OR
color: "var(--color-text-muted)"; // #64748B
```

#### 8. Primary Button

```jsx
{
  background: 'var(--gradient-button)',
  color: 'var(--color-text-primary-dark)',
  boxShadow: 'var(--shadow-md)',
  transition: 'all var(--transition-smooth)',
}
```

#### 9. Secondary/Ghost Button

```jsx
{
  background: 'transparent',
  border: '1.5px solid var(--color-border-light)',
  color: 'var(--color-text-muted)',
}
```

#### 10. Link

```jsx
color: "var(--color-primary)"; // #2FA4A9
```

#### 11. Link Hover

```jsx
color: "var(--color-hover)"; // #1F7F8B
```

#### 12. Input Field

```jsx
{
  border: '2px solid var(--color-border-light)',
  backgroundColor: 'var(--color-bg-light)',
  color: 'var(--color-text-dark)',
}
// Focus is auto-handled by global CSS
```

#### 13. Borders/Dividers

```jsx
border: "1px solid var(--color-border-light)"; // #E2E8F0
// OR for inputs:
border: "2px solid var(--color-border)"; // #D6E0E6
```

#### 14. Semi-transparent Overlay (Dark)

```jsx
backgroundColor: "var(--white-alpha-10)"; // rgba(255, 255, 255, 0.1)
```

#### 15. Semi-transparent Overlay (Light)

```jsx
backgroundColor: "var(--primary-alpha-10)"; // rgba(47, 164, 169, 0.1)
```

## 📊 All Variables at a Glance

### Colors

```
Primary: --color-primary (#2FA4A9)
Primary Dark: --color-primary-dark (#1F7F8B)
Accent: --color-accent (#5FD1D8)
Royal: --color-royal (#1E4FA3)

BG Dark: --color-bg-dark (#0B1F2A)
BG Dark Surface: --color-bg-dark-surface (#142F3A)
BG Light: --color-bg-light (#F8FAFC)
BG White: --color-bg-white (#FFFFFF)

Text Primary Dark: --color-text-primary-dark (#F8FAFC)
Text Primary Light: --color-text-primary-light (#1E4FA3)
Text Secondary: --color-text-secondary (#8FA6B3)
Text Muted: --color-text-muted (#64748B)
Text Dark: --color-text-dark (#1E293B)

Border: --color-border (#D6E0E6)
Border Light: --color-border-light (#E2E8F0)

Hover: --color-hover (#1F7F8B)
Focus: --color-focus (#5FD1D8)
Focus Glow: --color-focus-glow
```

### Gradients

```
--gradient-primary: Royal Blue → Primary Teal
--gradient-primary-hover: Darker variant for hover
--gradient-dark-bg: Midnight → Charcoal → Deep Aqua
--gradient-button: 3-color blend
```

### Shadows

```
--shadow-sm: Small elevation
--shadow-md: Medium elevation
--shadow-lg: Large elevation
--shadow-xl: Extra large elevation
--shadow-focus: Focus ring + glow
```

### Transitions

```
--transition-fast: 0.15s ease
--transition-base: 0.3s ease
--transition-smooth: 0.4s cubic-bezier
```

## 🔍 Find & Replace Cheatsheet

If you find old hardcoded colors, replace them:

```
#fff → var(--color-text-primary-dark) OR var(--color-bg-white)
#000 → var(--color-text-dark) OR var(--color-bg-dark)
#F8FAFC → var(--color-bg-light)
#2FA4A9 → var(--color-primary)
#1F7F8B → var(--color-primary-dark)
#1E4FA3 → var(--color-royal)
#5FD1D8 → var(--color-accent)
#0B1F2A → var(--color-bg-dark)
#E2E8F0 → var(--color-border-light)
#D6E0E6 → var(--color-border)
rgba(255,255,255,0.1) → var(--white-alpha-10)
```

## ✅ Checklist for New Components

When creating new components:

- [ ] Use `var(--color-bg-light)` or `var(--color-bg-white)` for backgrounds
- [ ] Use `var(--color-royal)` for headings on light backgrounds
- [ ] Use `var(--color-text-dark)` for body text on light backgrounds
- [ ] Use `var(--color-text-primary-dark)` for text on dark backgrounds
- [ ] Use `var(--gradient-button)` for primary buttons
- [ ] Use `var(--shadow-*)` instead of hardcoded shadows
- [ ] Use `var(--transition-*)` instead of hardcoded transitions
- [ ] Ensure focus states will work (auto-handled by global CSS)
- [ ] Test color contrast for accessibility

## 🎯 Pro Tips

1. **Don't hardcode colors** - Always use CSS variables
2. **Use semantic names** - `--color-primary` not `--teal`
3. **Consistent shadows** - Use the shadow system, don't create custom ones
4. **Consistent transitions** - Use the transition system
5. **Focus states** - Trust the global CSS for input focus
6. **Test contrast** - Ensure text is readable on backgrounds

---

For full documentation, see [COLOR_SYSTEM.md](COLOR_SYSTEM.md)
