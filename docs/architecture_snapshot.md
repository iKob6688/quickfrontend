# Quickfront18 Architecture Snapshot

**Generated:** 2025-01-XX  
**React Router:** v7.10.1  
**State Management:** Zustand (app/ui) + React Query (server state)  
**Styling:** Bootstrap 5.3.8 + Tailwind CSS 4.1.17 (via tailwind-merge)

---

## 📐 Routing Structure (React Router v7)

### Route Hierarchy

```
/ (root)
├── /login (public)
│   └── LoginPage
│
└── <ProtectedRoute>
    └── <AppLayout>
        ├── / (index) → redirects to /dashboard
        ├── /dashboard → DashboardPage
        ├── /sales/invoices → InvoicesListPage
        ├── /sales/invoices/new → InvoiceFormPage (create)
        ├── /sales/invoices/:id → InvoiceDetailPage
        ├── /sales/invoices/:id/edit → InvoiceFormPage (edit)
        ├── /excel-import → ExcelImportPage
        └── /backend-connection → BackendConnectionPage
```

### Route Configuration

**File:** `src/App.tsx`

- **Public Routes:**
  - `/login` - Login page (no auth required)

- **Protected Routes (require authentication):**
  - All routes under `<ProtectedRoute>` wrapper
  - Uses `useAuthStore` to check `isAuthenticated`
  - Redirects to `/login` if not authenticated

- **Layout Structure:**
  - `<AppLayout>` provides:
    - Top gradient header with logo and user info
    - Tab navigation (desktop) / Bottom nav (mobile)
    - Main content area with `<Outlet />`

### Navigation Items

Defined in `src/components/layout/AppLayout.tsx`:
- `/dashboard` - แดชบอร์ด
- `/sales/invoices` - ใบแจ้งหนี้
- `/excel-import` - Excel
- `/backend-connection` - การเชื่อมต่อ

---

## 📄 Existing Pages

### 1. Dashboard (`/dashboard`)
**File:** `src/features/dashboard/DashboardPage.tsx`

**Features:**
- User info display (name, login, company)
- Connection status card (ping API)
- Quick navigation cards to:
  - Invoices management
  - Excel import
  - Backend connection
- Instance ID display

**State:**
- `useAuthStore` - User data, instancePublicId
- `useQuery` - System ping (`/api/th/v1/ping`)

**Status:** ✅ Basic implementation, needs KPI/metrics from Odoo

---

### 2. Invoices (`/sales/invoices`)
**Files:**
- `InvoicesListPage.tsx` - List view
- `InvoiceDetailPage.tsx` - Detail view
- `InvoiceFormPage.tsx` - Create/Edit form

#### InvoicesListPage
**Features:**
- Tab filtering (all, draft, posted, paid, cancelled)
- Search by invoice number / customer name
- Data table with columns:
  - เลขที่เอกสาร (clickable → detail)
  - ลูกค้า
  - วันที่เอกสาร
  - มูลค่ารวม
  - สถานะ (badge)
- Actions: Create invoice, Print report (disabled)

**State:**
- `useQuery` - `listInvoices()` with filters
- Local state: `tab`, `q` (search query)

**API:** `POST /api/th/v1/sales/invoices/list`

#### InvoiceDetailPage
**Features:**
- Invoice header with number, customer, status badge
- Invoice lines table (description, quantity, unit price, subtotal)
- Document info sidebar:
  - Invoice number, dates, customer
  - Amount breakdown (untaxed, tax, total)
  - Notes
- Actions:
  - Back to list
  - Edit (if draft)
  - Post invoice (if draft)

**State:**
- `useQuery` - `getInvoice(id)`
- `useMutation` - `postInvoice()`, `registerPayment()`

**API:** 
- `POST /api/th/v1/sales/invoices/:id` (get)
- `POST /api/th/v1/sales/invoices/:id/post` (post)

#### InvoiceFormPage
**Features:**
- Form fields:
  - Customer ID (TODO: replace with selector)
  - Currency
  - Invoice date, Due date
  - Notes
- Invoice lines editor (TODO: implement)
- Actions: Save, Cancel

**State:**
- `useQuery` - `getInvoice(id)` (if editing)
- `useMutation` - `createInvoice()`, `updateInvoice()`

**API:**
- `POST /api/th/v1/sales/invoices` (create)
- `PUT /api/th/v1/sales/invoices/:id` (update)

**Status:** ⚠️ Partial - Invoice lines editor not implemented

---

### 3. Excel Import (`/excel-import`)
**File:** `src/features/excel-import/ExcelImportPage.tsx`

**Features:**
- Grid layout with import cards
- `ExcelUploadCard` components for:
  - `invoices` import
  - `customers` import

**State:** (handled in `ExcelUploadCard`)
- `useMutation` - `uploadExcelFile()`
- Polling for job status

**API:**
- `POST /api/th/v1/excel/import` (upload)
- `GET /api/th/v1/excel/import/:jobId` (status)
- `GET /api/th/v1/excel/import/:jobId/result` (result)

**Status:** ✅ Basic implementation

---

### 4. Backend Connection (`/backend-connection`)
**File:** `src/features/backend-connection/BackendConnectionPage.tsx`

**Features:**
- Company registration form:
  - Company name
  - Admin email
- Result display:
  - Company ID, name
  - Admin login credentials
  - Auto-login after creation

**State:**
- Local state: `companyName`, `adminEmail`, `isSubmitting`, `result`
- `useAuthStore` - `login()` for auto-login

**API:** `POST /api/th/v1/auth/register_company`

**Status:** ✅ Complete

---

### 5. Login (`/login`)
**File:** `src/features/auth/LoginPage.tsx`

**Features:**
- Username/password form
- Show/hide password toggle
- Error display
- Redirect to dashboard on success

**State:**
- `useAuthStore` - `login()`, `isLoading`, `error`
- Local state: `username`, `password`, `showPassword`

**API:** `POST /api/th/v1/auth/login`

**Status:** ✅ Complete

---

## 🔌 API Endpoints

### Base Configuration
- **Base URL:** `VITE_API_BASE_URL` (default: `/api`)
- **Format:** JSON-RPC 2.0 for Odoo endpoints
- **Auth:** Bearer token (`Authorization: Bearer <token>`)
- **Headers:**
  - `X-ADT-API-Key` - API key from bootstrap
  - `X-Instance-ID` - Instance ID for multi-tenant

### Endpoint Modules

#### 1. Auth (`src/api/endpoints/auth.ts`)
- `login(payload: LoginPayload)` → `POST /api/th/v1/auth/login`
- `getMe()` → `POST /api/th/v1/auth/me`
- `logout()` → `POST /api/th/v1/auth/logout`
- `registerCompany(payload: RegisterCompanyPayload)` → `POST /api/th/v1/auth/register_company`

#### 2. Invoices (`src/api/endpoints/invoices.ts`)
- `listInvoices(params?: ListInvoicesParams)` → `POST /api/th/v1/sales/invoices/list`
- `getInvoice(id: number)` → `POST /api/th/v1/sales/invoices/:id`
- `createInvoice(payload: InvoicePayload)` → `POST /api/th/v1/sales/invoices`
- `updateInvoice(id: number, payload: InvoicePayload)` → `PUT /api/th/v1/sales/invoices/:id`
- `postInvoice(id: number)` → `POST /api/th/v1/sales/invoices/:id/post`
- `registerPayment(id: number, payload: RegisterPaymentPayload)` → `POST /api/th/v1/sales/invoices/:id/register-payment`

#### 3. Excel (`src/api/endpoints/excel.ts`)
- `uploadExcelFile(params: { file: File, importType: ImportType })` → `POST /api/th/v1/excel/import`
- `getImportJob(jobId: string)` → `GET /api/th/v1/excel/import/:jobId`
- `getImportResult(jobId: string)` → `GET /api/th/v1/excel/import/:jobId/result`

#### 4. System (`src/api/endpoints/system.ts`)
- `ping()` → `POST /api/th/v1/ping`

#### 5. Bootstrap (`src/api/endpoints/bootstrap.ts`)
- `bootstrap(payload: BootstrapPayload)` → `POST /api/th/v1/frontend/bootstrap`
- **Note:** Typically called from CLI script (`npm run bootstrap`)

### API Client Configuration
**File:** `src/api/client.ts`

- **Axios instance** with:
  - Base URL from `VITE_API_BASE_URL`
  - Request interceptor: Adds `Authorization` and `X-Instance-ID` headers
  - Response interceptor: Handles 401 (unauthorized) → logout + redirect
  - Error handling: Converts to `ApiError`

### Response Format
**File:** `src/api/response.ts`

All endpoints use `unwrapResponse<T>()` to extract data from:
```typescript
interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: { message: string; code?: string; details?: unknown }
}
```

Odoo endpoints return JSON-RPC 2.0 format:
```typescript
{
  jsonrpc: "2.0",
  id: null,
  result: ApiEnvelope<T>
}
```

---

## 🗄️ State Management

### Zustand (App/UI State)

**Location:** `src/features/auth/store.ts`

**Store:** `useAuthStore`

**State:**
```typescript
{
  user: MeResponse | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error?: string
  instancePublicId: string | null
}
```

**Actions:**
- `login(payload: LoginPayload)` - Login and fetch user profile
- `logout()` - Clear auth state and call API logout
- `loadMe()` - Refresh user profile

**Usage:**
- Used in: `App.tsx`, `LoginPage`, `DashboardPage`, `AppLayout`, `BackendConnectionPage`, `ProtectedRoute`
- **Purpose:** Authentication state only (not business data)

### React Query (Server State)

**Configuration:** `src/main.tsx` - `QueryClient` with default options

**Usage Patterns:**

1. **Queries (Read):**
   ```typescript
   const { data, isLoading, error } = useQuery({
     queryKey: ['resource', id],
     queryFn: () => getResource(id),
     staleTime: 30_000,
   })
   ```

2. **Mutations (Write):**
   ```typescript
   const mutation = useMutation({
     mutationFn: (payload) => createResource(payload),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['resources'] })
     },
   })
   ```

**Query Keys:**
- `['invoices', tab, q]` - Invoice list with filters
- `['invoice', id]` - Single invoice detail
- `['system', 'ping']` - System ping

**Current Usage:**
- ✅ `InvoicesListPage` - `listInvoices()`
- ✅ `InvoiceDetailPage` - `getInvoice()`, `postInvoice()`, `registerPayment()`
- ✅ `InvoiceFormPage` - `getInvoice()`, `createInvoice()`, `updateInvoice()`
- ✅ `DashboardPage` - `ping()`

---

## 🎨 CSS Usage

### Bootstrap 5.3.8

**Primary usage:** Layout, components, utilities

**Common classes:**
- Layout: `d-flex`, `row`, `col-*`, `container-fluid`, `gap-*`
- Components: `btn`, `btn-primary`, `card`, `alert`, `badge`, `form-control`
- Utilities: `fw-semibold`, `text-muted`, `mb-*`, `px-*`, `py-*`

**Usage pattern:**
- Bootstrap for structure and base components
- Custom UI components wrap Bootstrap with additional styling

### Tailwind CSS 4.1.17

**Primary usage:** Utility classes via `tailwind-merge` in custom components

**Usage pattern:**
- `twMerge()` used in UI components (`Button`, `Card`, `Input`, etc.)
- Allows combining Bootstrap classes with Tailwind utilities
- Minimal direct Tailwind usage in pages (mostly Bootstrap)

**Files using Tailwind:**
- `src/components/ui/*.tsx` - Custom components use `twMerge()`
- `src/features/backend-connection/BackendConnectionPage.tsx` - Some Tailwind classes (`space-y-*`, `rounded-2xl`)
- `src/features/auth/LoginPage.tsx` - Some Tailwind classes

**Note:** Mixed usage - Bootstrap is primary, Tailwind used for specific styling needs

### Custom Styling

**File:** `src/index.css`
- Global styles
- Bootstrap imports
- Tailwind directives
- Custom CSS variables (if any)

---

## 📦 Component Structure

### UI Components (`src/components/ui/`)

- `Button.tsx` - Button with variants (primary, secondary, ghost)
- `Card.tsx` - Card container
- `Input.tsx` - Form input
- `Label.tsx` - Form label
- `Badge.tsx` - Status badge
- `DataTable.tsx` - Table component
- `Tabs.tsx` - Tab navigation
- `PageHeader.tsx` - Page header with title, subtitle, breadcrumb, actions
- `Tooltip.tsx` - Tooltip component
- `InlineHelp.tsx` - Inline help text

**Pattern:** All use `twMerge()` to combine Bootstrap + Tailwind classes

### Layout Components

- `AppLayout.tsx` - Main app layout (header, nav, content)
- `PageContainer.tsx` - Page content container
- `ProtectedRoute.tsx` - Auth guard wrapper

### Icons

- `AppLogo.tsx` - Application logo
- `BrandIcon.tsx` - Brand icon
- `ConnectionStatusIcon.tsx` - Connection status indicator
- `TokenIcon.tsx` - Token icon

---

## 🔍 Gaps vs PEAK-style Accounting UX

### Missing Pages/Features

1. **Dashboard KPIs**
   - ❌ Revenue metrics (monthly, YTD)
   - ❌ Expense metrics
   - ❌ Profit/loss chart
   - ❌ Outstanding invoices summary
   - ❌ Cash flow chart
   - **Status:** Placeholder only, needs backend KPI endpoints

2. **Invoice Management**
   - ⚠️ Invoice lines editor (form incomplete)
   - ❌ Customer selector/search (currently manual ID input)
   - ❌ Product selector/search
   - ❌ Tax calculation preview
   - ❌ Payment registration form/modal
   - ❌ Invoice printing/PDF export
   - ❌ Bulk actions (post multiple, export)

3. **Customer Management**
   - ❌ Customer list page
   - ❌ Customer detail page
   - ❌ Customer create/edit form
   - ❌ Customer payment history

4. **Expense Management**
   - ❌ Expense list page
   - ❌ Expense create/edit form
   - ❌ Expense categories
   - ❌ Receipt upload/attachment

5. **Reports**
   - ❌ Financial reports (P&L, Balance Sheet)
   - ❌ Tax reports
   - ❌ Aging reports
   - ❌ Custom report builder

6. **Settings**
   - ❌ Company settings
   - ❌ User management
   - ❌ Tax configuration
   - ❌ Chart of accounts

7. **Mobile Experience**
   - ⚠️ Bottom nav exists but needs optimization
   - ❌ Mobile-optimized forms
   - ❌ Touch-friendly interactions

### UX Improvements Needed

1. **Loading States**
   - ✅ Basic spinners exist
   - ❌ Skeleton loaders for better UX
   - ❌ Optimistic updates for mutations

2. **Error Handling**
   - ✅ Basic error messages
   - ❌ Retry mechanisms
   - ❌ Offline detection and queueing (infrastructure exists but not fully integrated)

3. **Data Visualization**
   - ❌ Charts for financial data (Recharts installed but not used)
   - ❌ Trend indicators
   - ❌ Comparison views

4. **Search & Filtering**
   - ✅ Basic search in invoice list
   - ❌ Advanced filters (date range, amount range, etc.)
   - ❌ Saved filter presets

5. **Notifications**
   - ❌ Toast notifications for success/error
   - ❌ In-app notifications
   - ❌ Email notifications (backend)

6. **Accessibility**
   - ⚠️ Basic ARIA labels
   - ❌ Keyboard navigation optimization
   - ❌ Screen reader optimization

### Technical Gaps

1. **Type Safety**
   - ✅ Good TypeScript coverage
   - ⚠️ Some `any` types in form handling

2. **Testing**
   - ❌ No unit tests
   - ❌ No integration tests
   - ❌ No E2E tests

3. **Performance**
   - ✅ React Query caching
   - ❌ Virtual scrolling for large lists
   - ❌ Code splitting / lazy loading

4. **Internationalization**
   - ⚠️ i18next installed but minimal usage
   - ❌ Full Thai/English support

---

## 📊 Summary

### ✅ Strengths
- Clean architecture (separation of concerns)
- Proper state management (Zustand + React Query)
- Type-safe API layer
- Responsive layout structure
- Bootstrap + Tailwind integration

### ⚠️ Areas for Improvement
- Complete invoice form (lines editor)
- Dashboard KPIs from backend
- Customer/product management
- Reports and analytics
- Mobile optimization
- Error handling and retry logic

### 🎯 Priority Next Steps
1. **Invoice Lines Editor** - Complete the form for creating/editing invoice lines
2. **Customer Selector** - Replace manual ID input with searchable dropdown
3. **Dashboard KPIs** - Backend endpoints + frontend visualization
4. **Payment Registration** - Modal/form for recording payments
5. **Mobile Optimization** - Improve touch interactions and form layouts

---

**Last Updated:** 2025-01-XX

