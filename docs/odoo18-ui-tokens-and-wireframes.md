# Odoo 18 UI Tokens + Wireframes (Quickfront18 / Enterprise UX)

This document provides **design tokens**, **CSS snippets**, and **wireframes** that can be integrated into Odoo 18 frontend assets without destructively overriding core styles.

---

## Design tokens (recommended)

### Typography scale

- **Display**: 32 / 700 / LH 1.2
- **H1**: 28 / 700 / LH 1.25
- **H2**: 22 / 700 / LH 1.3
- **H3**: 18 / 600 / LH 1.35
- **Body**: 15 / 400 / LH 1.65
- **Label**: 13 / 600 / LH 1.45
- **Micro**: 11 / 600 / LH 1.35

### Spacing & components

- **Table row height**: 44px
- **Cell padding**: 16px × 12px
- **Radius**: 16px / 24px

---

## Odoo 18 integration strategy (safe)

### Goal

Apply a modern enterprise “document + accounting” UI without breaking Odoo views:

- Don’t overwrite global selectors like `*`, `.o_form_view *`, etc.
- Scope to a wrapper class on the web client (recommended): **`.qf18-theme`**

### How to enable

Add this class at runtime:

- `document.documentElement.classList.add('qf18-theme')` (or on `.o_web_client`)
- Or in Odoo: patch the main web client template to add the class (asset build).

---

## CSS snippet (scoped, non-destructive)

Put into an asset bundle (e.g. `web.assets_backend`) as `qf18_theme.scss` or `qf18_theme.css`.

```css
/* Scope EVERYTHING under .qf18-theme to avoid breaking Odoo core UI */
.qf18-theme {
  /* Typography tokens */
  --qf-font-sans: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Segoe UI", "Noto Sans Thai", "Noto Sans Thai UI", Tahoma, sans-serif;

  --qf-text-h1: 28px;
  --qf-text-h2: 22px;
  --qf-text-h3: 18px;
  --qf-text-body: 15px;
  --qf-text-label: 13px;
  --qf-text-micro: 11px;

  --qf-lh-h1: 1.25;
  --qf-lh-h2: 1.3;
  --qf-lh-h3: 1.35;
  --qf-lh-body: 1.65;

  /* Surface tokens */
  --qf-surface: rgba(255, 255, 255, 0.92);
  --qf-border: rgba(255, 255, 255, 0.7);
  --qf-shadow: 0 14px 28px rgba(15, 23, 42, 0.10);
  --qf-shadow-hover: 0 18px 40px rgba(15, 23, 42, 0.14);
  --qf-zebra: rgba(255, 255, 255, 0.40);
  --qf-row-hover: rgba(244, 247, 251, 0.60);

  font-family: var(--qf-font-sans);
}

/* 1) Headings in custom module screens (only if you wrap your views in .qf18-page) */
.qf18-theme .qf18-page h1 {
  font-size: var(--qf-text-h1);
  line-height: var(--qf-lh-h1);
  font-weight: 700;
}
.qf18-theme .qf18-page h2 {
  font-size: var(--qf-text-h2);
  line-height: var(--qf-lh-h2);
  font-weight: 700;
}
.qf18-theme .qf18-page h3 {
  font-size: var(--qf-text-h3);
  line-height: var(--qf-lh-h3);
  font-weight: 600;
}

/* 2) Document tables (list-like views) – scoped to your own container */
.qf18-theme .qf18-page .qf18-table {
  background: var(--qf-surface);
  border: 1px solid var(--qf-border);
  box-shadow: var(--qf-shadow);
  border-radius: 24px;
  overflow: hidden;
}
.qf18-theme .qf18-page .qf18-table thead th {
  font-size: var(--qf-text-label);
  font-weight: 600;
  opacity: 0.75;
  padding: 12px 16px;
}
.qf18-theme .qf18-page .qf18-table tbody td {
  font-size: var(--qf-text-body);
  padding: 12px 16px;
}
.qf18-theme .qf18-page .qf18-table tbody tr:nth-child(odd) {
  background: var(--qf-zebra);
}
.qf18-theme .qf18-page .qf18-table tbody tr:hover {
  background: var(--qf-row-hover);
}

/* 3) Inputs (only inside your module pages) */
.qf18-theme .qf18-page .qf18-input {
  border-radius: 16px;
  border: 1px solid rgba(230, 238, 247, 1);
  background: #fff;
  box-shadow: var(--qf-shadow);
  height: 44px;
  padding: 0 12px;
  font-size: 16px; /* prevents iOS zoom */
}
.qf18-theme .qf18-page .qf18-input:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(47, 128, 237, 0.25);
}

/* 4) Help + errors */
.qf18-theme .qf18-page .qf18-help {
  font-size: var(--qf-text-label);
  opacity: 0.7;
}
.qf18-theme .qf18-page .qf18-error {
  font-size: var(--qf-text-label);
  color: #be123c;
  background: rgba(190, 18, 60, 0.08);
  border-radius: 16px;
  padding: 10px 12px;
}
```

---

## Wireframes (key accounting flows)

### A) Dashboard (enterprise)

```text
┌──────────────────────────── Top gradient header ────────────────────────────┐
│ Logo | Company ▼ | Search… | Notifications | Language | User ▼              │
└─────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────── Tab navigation ─────────────────────────────────┐
│ Dashboard | Sales | Purchases | VAT | Accounting | Reports | Settings        │
└─────────────────────────────────────────────────────────────────────────────┘

H1 Dashboard
KPI Row:  [Revenue] [Expenses] [Profit] [Overdue]   (big numbers, high contrast)
Widgets:  [Cashflow chart] [A/R aging] [Top customers] [Pending approvals]
```

### B) Document list (invoices/receipts)

```text
H1 Receipts / Invoices
Toolbar:  [ + Create ] [ Print ] [ Export ]              [ Search input ]
Tabs:     All | Draft | Posted | Paid | Cancelled

Table:
| Doc No | Customer | Date | Total | Status |
|  ... zebra rows, hover, right-aligned numbers, status badge ... |
```

### C) Document create/edit (uniform)

```text
H1 Create Invoice
Header actions (right): [ Save Draft ] [ Post ] [ More ▾ ]

Form grid:
Left:  Customer*, Invoice date*, Due date, Currency
Right: Reference, Payment term, Salesperson

Lines:
| Product* | Description | Qty | Unit price | Tax | Subtotal |

Footer summary:
Subtotal / Tax / Total (large & bold)
```

---

## Notes for compatibility with Odoo 18

- Prefer scoping under `.qf18-theme .qf18-page` to avoid touching default list/form views.
- If you must align with Odoo variables, do it by **setting CSS vars**, not overwriting core classes.
- Keep input text >= 16px on mobile to avoid Safari zoom.


