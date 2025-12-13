# Quickfront18 UI Audit Report
**Date:** 2025-12-12  
**Scope:** Typography, Colors, Cards, Forms, Tables  
**Goal:** Upgrade to modern accounting SaaS standards (PEAK-like)

---

## PHASE A — Current State Inventory

### 1. Typography System

**Font Family:**
- Current: `system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', 'Noto Sans Thai', 'Noto Sans Thai UI', Tahoma, sans-serif`
- Base size: `15px` (via `--qf-text-body`)
- Line-height: `1.7` (body), `1.25` (page title), `1.35` (section title)

**Font Scale (found in tokens.css + tailwind.config.js):**
- `pageTitle`: 26px / 700 / 1.25
- `sectionTitle`: 16px / 600 / 1.35
- `body`: 15px / 400 / 1.7
- `meta`: 12px / 500 / 1.45
- `micro`: 11px / 600 / 1.35
- `number`: 15px / 600 / 1.4
- `numberLg`: 20px / 700 / 1.25

**Issues Found:**
- Some hardcoded sizes in components (e.g., `text-xs`, `text-sm` without token mapping)
- Inconsistent weight usage (some `font-semibold`, some `font-bold`)
- Missing explicit rem-based scale for better accessibility

---

### 2. Color System

**Current Colors (from tailwind.config.js):**
- Primary: `#2F80ED` (blue)
- Primary Dark: `#1D4ED8`
- Secondary: `#1CC8B7` (teal)
- Accent Gold: `#FBBF24`
- Accent Pink: `#C93C8D`
- Background Light: `#F4F7FB`
- Surface Dark: `#0B1B3A`
- Muted: `#64748B`
- Card Border: `#E6EEF7`

**Hardcoded Colors Found:**
- `#0b1b3a` in `index.css` (body text)
- `rgba(201, 60, 141, 0.16)` and `rgba(251, 191, 36, 0.18)` in gradient
- `#f0f7ff`, `#c7ecff`, `#00a8c5`, `#0b6ea6` in ocean-diagonal gradient
- Status colors in Badge: `emerald-50/700/200`, `rose-50/700/200`, `amber-50/800/200`

**Issues:**
- No semantic color roles (e.g., `--text-strong`, `--bg-0`)
- Status colors not tokenized (using Tailwind defaults)
- No WCAG contrast verification documented

---

### 3. Card Styles

**Current Pattern (Card.tsx):**
- Radius: `rounded-3xl` (24px)
- Border: `border border-white/70`
- Shadow: `shadow-card` (0 14px 28px rgba(15, 23, 42, 0.10))
- Padding: `px-4 py-4 sm:px-5 sm:py-5` (16px/20px)
- Background: `bg-white/95` with `backdrop-blur-xl`

**Issues:**
- Padding not tokenized
- Border opacity hardcoded
- No hover state for clickable cards (some cards have `hover:bg-white/90` inline)

---

### 4. Form Patterns

**Input Component:**
- Height: `h-11` (44px) ✅ touch-friendly
- Font size: `text-[16px]` ✅ prevents iOS zoom
- Border: `border-cardBorder`
- Focus: `ring-2 ring-primary/30`
- Label: **MISSING** — no visible label prop, relies on placeholder

**Issues:**
- No explicit label component/pattern
- Helper text pattern exists (`InlineHelp.tsx`) but not consistently used
- Error message styling not standardized

---

### 5. Table Patterns

**DataTable Component:**
- Header: `bg-white/35`, `text-meta font-semibold uppercase tracking-[0.14em]`
- Row height: implicit via `py-3.5` (~46px)
- Borders: `border-t border-cardBorder/40` (subtle, good)
- Zebra: `bg-white/40` vs `bg-white/0`
- Cell padding: `px-4 py-3.5`

**Issues:**
- Row height not explicitly tokenized (should match `--qf-table-row-h`)
- Amount alignment handled via `className` prop (good, but should be default for numeric columns)

---

## Summary & Recommendations

### Strengths:
1. ✅ Token system started (`tokens.css`)
2. ✅ Typography scale defined
3. ✅ Touch-friendly inputs (16px)
4. ✅ Modern card style (backdrop blur, subtle shadows)

### Gaps to Address:
1. ❌ Color system needs semantic roles (surfaces, text, status)
2. ❌ Form labels missing (placeholder-only pattern)
3. ❌ WCAG contrast not verified
4. ❌ Some hardcoded values remain
5. ❌ Card hover states inconsistent

### Next Steps:
1. Expand token system with semantic color roles
2. Add form label component/pattern
3. Document WCAG compliance
4. Refactor all components to use tokens
5. Standardize hover/focus states

