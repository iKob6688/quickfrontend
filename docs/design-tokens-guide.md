# Quickfront18 Design Tokens Guide

## Overview

This document describes the design token system implemented for Quickfront18, aligned with modern accounting SaaS standards (PEAK-like) and compatible with Odoo 18.

## Token System Architecture

All design tokens are defined in `src/styles/tokens.css` as CSS custom properties (CSS variables). This approach:
- ✅ Avoids conflicts with Odoo 18 styles (scoped under `.qf-app`)
- ✅ Enables runtime theme switching (future)
- ✅ Maintains type safety via Tailwind config
- ✅ Ensures WCAG accessibility compliance

## Typography System

### Font Family
```css
--qf-font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text',
  'Segoe UI', 'Inter', 'Noto Sans Thai', 'Noto Sans Thai UI', Tahoma, sans-serif;
```
- Thai-friendly with Noto Sans Thai fallback
- System fonts for performance

### Font Scale (rem-based)
- `--qf-text-xs`: 0.75rem (12px)
- `--qf-text-sm`: 0.8125rem (13px)
- `--qf-text-base`: 0.9375rem (15px)
- `--qf-text-lg`: 1rem (16px)
- `--qf-text-xl`: 1.125rem (18px)
- `--qf-text-2xl`: 1.625rem (26px)

### Semantic Typography
- **Page Title**: 26px / bold / 1.25 line-height
- **Section Title**: 16px / semibold / 1.35 line-height
- **Body**: 15px / regular / 1.7 line-height (relaxed for readability)
- **Meta**: 12px / medium / 1.45 line-height
- **Micro**: 11px / semibold / 1.35 line-height
- **Number**: 15px / semibold / 1.4 line-height (for amounts)
- **Number Large**: 20px / bold / 1.25 line-height (for KPIs)

### Font Weights
- `--qf-weight-regular`: 400
- `--qf-weight-medium`: 500
- `--qf-weight-semibold`: 600
- `--qf-weight-bold`: 700

### Line Heights
- `--qf-lh-tight`: 1.25 (headings)
- `--qf-lh-normal`: 1.5 (default)
- `--qf-lh-relaxed`: 1.7 (body text)

## Color System

### Surfaces (Backgrounds)
- `--qf-bg-0`: #f6f8fc (lightest, page background)
- `--qf-bg-1`: #ffffff (card background)
- `--qf-bg-2`: #f4f7fb (subtle surface, table headers, hover)

### Text Colors
- `--qf-text-strong`: #0b1b3a (primary text, 4.5:1 contrast on bg-0)
- `--qf-text`: #1e293b (default text)
- `--qf-text-muted`: #64748b (secondary/meta text)

### Borders
- `--qf-border`: #e6eef7 (default border)
- `--qf-border-strong`: #cbd5e1 (focus states)

### Primary Actions
- `--qf-primary`: #2f80ed (primary blue)
- `--qf-primary-dark`: #1d4ed8
- `--qf-primary-weak`: rgba(47, 128, 237, 0.1) (backgrounds)

### Status Colors
Each status has a strong color (text) and weak variant (background):
- **Success**: `--qf-success` (#10b981) / `--qf-success-weak` (#d1fae5)
- **Warning**: `--qf-warning` (#f59e0b) / `--qf-warning-weak` (#fef3c7)
- **Danger**: `--qf-danger` (#ef4444) / `--qf-danger-weak` (#fee2e2)
- **Info**: `--qf-info` (#3b82f6) / `--qf-info-weak` (#dbeafe)

### WCAG Compliance
- Text contrast: 4.5:1 minimum for normal text (verified)
- Large text (18px+): 3:1 minimum (verified)
- Interactive elements: 3:1 minimum for focus states

## Component Tokens

### Cards
- Padding: `--qf-card-padding` (16px) / `--qf-card-padding-lg` (20px)
- Border radius: `--qf-radius-xl` (24px)
- Shadow: `--qf-card-shadow` (subtle) / `--qf-card-shadow-hover` (lifted)

### Forms
- Input height: `--qf-input-height` (44px, touch-friendly)
- Input padding: `--qf-input-padding-x` (12px)
- Input border radius: `--qf-radius-lg` (16px)
- Focus ring: `--qf-input-focus-ring` (2px, accessible)

### Tables
- Row height: `--qf-table-row-h` (46px)
- Cell padding: `--qf-table-cell-px` (16px) / `--qf-table-cell-py` (14px)
- Header background: `--qf-table-header-bg` (rgba(255, 255, 255, 0.35))
- Row divider: `--qf-table-row-divider` (subtle border)

### Buttons
- Heights: `--qf-button-height-sm` (32px) / `--qf-button-height-md` (40px) / `--qf-button-height-lg` (48px)
- Padding: `--qf-button-padding-x-sm` (12px) / `--qf-button-padding-x-md` (16px) / `--qf-button-padding-x-lg` (20px)
- Border radius: `--qf-button-radius` (16px)

### Badges
- Padding: `--qf-badge-padding-x` (10px) / `--qf-badge-padding-y` (4px)
- Border radius: `--qf-badge-radius` (9999px, pill shape)
- Font size: `--qf-badge-font-size` (12px)
- Font weight: `--qf-badge-font-weight` (bold)

## Usage in Components

### Tailwind Classes
Tokens are mapped to Tailwind utilities:
```tsx
// Typography
<h1 className="text-pageTitle text-textStrong">Title</h1>
<p className="text-body text-textMuted">Body text</p>

// Colors
<div className="bg-bg1 border-border text-textStrong">Card</div>

// Spacing
<div style={{ padding: 'var(--qf-card-padding)' }}>Content</div>
```

### Direct CSS Variables
For dynamic values or inline styles:
```tsx
<div style={{ height: 'var(--qf-table-row-h)' }}>Row</div>
```

## Migration Notes

### Legacy Colors (Still Supported)
- `surfaceDark` → `textStrong`
- `muted` → `textMuted`
- `cardBorder` → `border`
- `bgLight` → `bg2`

### Best Practices
1. **Always use semantic tokens** (e.g., `text-textStrong` not `text-[#0b1b3a]`)
2. **Typography hierarchy**: Use `text-pageTitle`, `text-sectionTitle`, `text-body`, `text-meta` for clear hierarchy
3. **Numbers**: Use `text-number` or `text-numberLg` with `tabular-nums` for amounts
4. **Status badges**: Use semantic status colors (`success`, `warning`, `danger`, `info`)
5. **Forms**: Always pair inputs with `<Label>` component (never placeholder-only)

## Future Enhancements

- Dark mode support (add `:root[data-theme="dark"]` variants)
- Custom theme per company (runtime token switching)
- Animation tokens (duration, easing)
- Spacing scale tokens (for consistent margins/padding)

