# PEAK-style Accounting UX - Gap Analysis

**Reference:** Modern accounting SaaS UX patterns (PEAK, QuickBooks, Xero)  
**Current State:** Quickfront18 v0.0.0  
**Last Updated:** 2025-01-XX

---

## 📄 Current Pages Status

### ✅ Implemented Pages

| Page | Route | Status | Features |
|------|-------|--------|----------|
| **Login** | `/login` | ✅ Complete | Username/password, error handling, auto-redirect |
| **Dashboard** | `/dashboard` | ⚠️ Basic | User info, connection status, navigation cards (no KPIs) |
| **Invoice List** | `/sales/invoices` | ✅ Complete | List, filter, search, status tabs, navigation |
| **Invoice Detail** | `/sales/invoices/:id` | ✅ Complete | Full invoice view, lines table, actions (post, edit) |
| **Invoice Form** | `/sales/invoices/new`, `/sales/invoices/:id/edit` | ⚠️ Partial | Basic form (missing: lines editor, customer selector) |
| **Excel Import** | `/excel-import` | ✅ Complete | Upload, job status, result display |
| **Backend Connection** | `/backend-connection` | ✅ Complete | Company registration, auto-login |

### ❌ Missing Pages

| Page | Priority | Description |
|------|----------|-------------|
| **Customer List** | 🔴 High | List all customers with search/filter |
| **Customer Detail** | 🔴 High | Customer profile, payment history, invoices |
| **Customer Form** | 🔴 High | Create/edit customer (replaces manual ID input) |
| **Product List** | 🟡 Medium | List all products/services |
| **Product Form** | 🟡 Medium | Create/edit products |
| **Expense List** | 🟡 Medium | List all expenses |
| **Expense Form** | 🟡 Medium | Create/edit expenses with receipt upload |
| **Reports Dashboard** | 🟡 Medium | Financial reports hub |
| **P&L Report** | 🟡 Medium | Profit & Loss statement |
| **Balance Sheet** | 🟡 Medium | Balance sheet report |
| **Aging Report** | 🟡 Medium | Accounts receivable/payable aging |
| **Settings** | 🟢 Low | Company settings, user management, tax config |

---

## 🎯 Feature Gaps by Category

### 1. Dashboard & KPIs

**Current:** Basic placeholder with user info

**Missing:**
- ❌ Revenue metrics (monthly, YTD, YoY growth)
- ❌ Expense metrics (monthly, YTD)
- ❌ Profit/Loss chart (line/bar chart)
- ❌ Outstanding invoices summary (count, total amount)
- ❌ Cash flow chart (inflow/outflow)
- ❌ Top customers (by revenue)
- ❌ Recent transactions list
- ❌ Quick actions (create invoice, record expense)

**PEAK Pattern:**
- Large, readable numbers with trend indicators (↑↓)
- Color-coded metrics (green = positive, red = negative)
- Interactive charts (click to drill down)
- Customizable widgets (drag & drop)

**Priority:** 🔴 High (core accounting UX)

---

### 2. Invoice Management

**Current:** ✅ List, detail, basic form

**Missing:**
- ⚠️ **Invoice Lines Editor** (form incomplete)
  - Add/remove/edit lines
  - Product selector with search
  - Quantity, price, discount inputs
  - Tax calculation preview
  - Subtotal per line
- ❌ **Customer Selector**
  - Searchable dropdown (replaces manual ID input)
  - Recent customers quick select
  - Create customer from invoice form
- ❌ **Payment Registration**
  - Modal/form for recording payments
  - Payment method selection
  - Partial payment support
  - Payment history view
- ❌ **Invoice Actions**
  - Print/PDF export
  - Email invoice
  - Duplicate invoice
  - Cancel invoice
  - Bulk actions (post multiple, export)
- ❌ **Invoice Status Workflow**
  - Visual status indicators
  - Status change history
  - Due date warnings

**PEAK Pattern:**
- Inline editing for invoice lines
- Auto-save drafts
- Real-time total calculation
- Payment matching (link payments to invoices)

**Priority:** 🔴 High (core feature)

---

### 3. Customer Management

**Current:** ❌ Not implemented

**Missing:**
- ❌ Customer list page
  - Search, filter (status, payment terms)
  - Sortable columns
  - Bulk actions
- ❌ Customer detail page
  - Profile info (name, address, tax ID, contact)
  - Payment terms, credit limit
  - Invoice history (linked invoices)
  - Payment history
  - Outstanding balance
  - Notes/attachments
- ❌ Customer form
  - Create/edit customer
  - Address fields
  - Tax information
  - Payment terms
  - Credit limit

**PEAK Pattern:**
- Customer card view (visual, easy to scan)
- Quick actions (create invoice, record payment)
- Customer activity timeline
- Credit limit warnings

**Priority:** 🔴 High (needed for invoice form)

---

### 4. Product/Service Management

**Current:** ❌ Not implemented

**Missing:**
- ❌ Product list page
  - Search, filter (category, type)
  - Product code, name, price
- ❌ Product form
  - Create/edit products
  - SKU/code
  - Name, description
  - Price, cost
  - Tax category
  - Category/tags

**PEAK Pattern:**
- Product catalog with images
- Bulk import/export
- Price lists (different prices for different customers)

**Priority:** 🟡 Medium (needed for invoice lines)

---

### 5. Expense Management

**Current:** ❌ Not implemented

**Missing:**
- ❌ Expense list page
  - Search, filter (date, category, vendor)
  - Receipt images
  - Approval workflow (if needed)
- ❌ Expense form
  - Create/edit expenses
  - Vendor/supplier
  - Category
  - Amount, tax
  - Receipt upload
  - Payment method
  - Recurring expenses

**PEAK Pattern:**
- Receipt OCR (auto-fill from image)
- Expense categories with icons
- Mileage tracking
- Expense reports

**Priority:** 🟡 Medium

---

### 6. Reports & Analytics

**Current:** ❌ Not implemented

**Missing:**
- ❌ Reports dashboard
  - Report categories
  - Favorite reports
  - Recent reports
- ❌ Profit & Loss (P&L)
  - Income vs expenses
  - Period comparison
  - Export PDF/Excel
- ❌ Balance Sheet
  - Assets, liabilities, equity
  - Date range selection
- ❌ Aging Reports
  - Accounts receivable aging
  - Accounts payable aging
  - Overdue warnings
- ❌ Tax Reports
  - VAT summary
  - Tax filing data
- ❌ Custom Reports
  - Report builder
  - Custom date ranges
  - Column selection

**PEAK Pattern:**
- Visual charts (bar, line, pie)
- Drill-down capability
- Scheduled reports (email)
- Comparison views (this month vs last month)

**Priority:** 🟡 Medium

---

### 7. Settings & Configuration

**Current:** ❌ Not implemented

**Missing:**
- ❌ Company settings
  - Company info (name, address, tax ID)
  - Logo upload
  - Fiscal year settings
  - Currency settings
- ❌ User management
  - User list
  - Role/permissions
  - Invite users
- ❌ Tax configuration
  - Tax rates
  - Tax categories
  - Tax rules
- ❌ Chart of Accounts
  - Account list
  - Account hierarchy
  - Account types

**PEAK Pattern:**
- Settings organized by category
- Search in settings
- Help tooltips for each setting

**Priority:** 🟢 Low (can use Odoo native UI for now)

---

## 🎨 UX/UI Improvements Needed

### 1. Loading States
- ✅ Basic spinners exist
- ❌ Skeleton loaders (better perceived performance)
- ❌ Optimistic updates (show changes immediately, sync in background)

### 2. Error Handling
- ✅ Basic error messages
- ❌ Retry mechanisms (auto-retry on network errors)
- ❌ Offline detection and queueing (infrastructure exists, needs integration)
- ❌ Error boundaries (prevent full app crash)

### 3. Data Visualization
- ❌ Charts for financial data (Recharts installed but unused)
  - Revenue trends
  - Expense breakdown (pie chart)
  - Cash flow (line chart)
- ❌ Trend indicators (↑↓ arrows, percentage change)
- ❌ Comparison views (this month vs last month)

### 4. Search & Filtering
- ✅ Basic search in invoice list
- ❌ Advanced filters
  - Date range picker
  - Amount range
  - Status multi-select
  - Customer filter
- ❌ Saved filter presets
- ❌ Global search (search across invoices, customers, products)

### 5. Notifications & Feedback
- ❌ Toast notifications (success/error messages)
- ❌ In-app notifications (new invoice, payment received)
- ❌ Email notifications (backend)

### 6. Mobile Experience
- ⚠️ Bottom nav exists but needs optimization
- ❌ Mobile-optimized forms (larger inputs, better spacing)
- ❌ Touch-friendly interactions (swipe actions, pull-to-refresh)
- ❌ Mobile-specific layouts (stack cards vertically)

### 7. Accessibility
- ⚠️ Basic ARIA labels
- ❌ Keyboard navigation optimization
- ❌ Screen reader optimization
- ❌ Focus management (focus trap in modals)

---

## 📊 Priority Matrix

### 🔴 High Priority (Core Accounting Features)
1. **Invoice Lines Editor** - Complete the form
2. **Customer Selector** - Replace manual ID input
3. **Dashboard KPIs** - Revenue, expenses, profit charts
4. **Payment Registration** - Record payments on invoices
5. **Customer Management** - List, detail, form pages

### 🟡 Medium Priority (Enhanced Features)
1. **Product Management** - Needed for invoice lines
2. **Expense Management** - Track business expenses
3. **Reports** - P&L, Balance Sheet, Aging
4. **Advanced Search/Filter** - Better data discovery
5. **Charts & Visualization** - Use Recharts library

### 🟢 Low Priority (Nice to Have)
1. **Settings Pages** - Can use Odoo native UI
2. **Custom Reports Builder** - Advanced feature
3. **Mobile Optimization** - If mobile usage is high
4. **Internationalization** - Full i18n support

---

## 🚀 Quick Wins (Low Effort, High Impact)

1. **Skeleton Loaders** - Replace spinners with skeleton screens
2. **Toast Notifications** - Add success/error toasts
3. **Optimistic Updates** - Show changes immediately
4. **Trend Indicators** - Add ↑↓ arrows to KPI cards
5. **Better Empty States** - More helpful empty state messages

---

## 📝 Implementation Notes

### Backend Dependencies
Many features require backend endpoints:
- Dashboard KPIs → `/api/th/v1/dashboard/kpis`
- Customer list → `/api/th/v1/customers`
- Product list → `/api/th/v1/products`
- Reports → `/api/th/v1/reports/*`

### Frontend Dependencies
- Recharts (already installed) - For charts
- React Hook Form (not installed) - For better form handling
- React Hot Toast (not installed) - For toast notifications
- Date-fns (not installed) - For date formatting/parsing

---

**Last Updated:** 2025-01-XX

