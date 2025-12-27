# Purchase Orders & Partners API Verification

This document verifies that Purchase Orders API and Partners API (Customers/Vendors) are properly connected and working.

## 1. Purchase Orders API

### 1.1 Frontend Implementation ✅

- **Service**: `src/api/services/purchases.service.ts`
  - ✅ `listPurchaseOrders()` - List with filters/pagination
  - ✅ `getPurchaseOrder()` - Get single order
  - ✅ `createPurchaseOrder()` - Create new order
  - ✅ `updatePurchaseOrder()` - Update existing order
  - ✅ `confirmPurchaseOrder()` - Confirm order
  - ✅ `cancelPurchaseOrder()` - Cancel order
- **Endpoints**: `src/api/endpoints/purchases.ts` - Re-exports
- **UI Pages**:
  - ✅ `src/features/purchases/PurchaseOrdersListPage.tsx` - List page with tabs, search, DataTable
  - ✅ Routes added to `src/App.tsx` (`/purchases/orders`)
  - ✅ Navigation item added to `src/components/layout/AppLayout.tsx`

### 1.2 Dashboard Integration ✅

- ✅ Added Purchase Orders card to `src/features/dashboard/DashboardPage.tsx`
- ✅ Fetches purchase orders data using `listPurchaseOrders()`
- ✅ Calculates stats: draftCount, sentCount, purchaseCount, doneCount, totalValue
- ✅ Displays summary: count of active orders and total value
- ✅ Clickable card navigates to `/purchases/orders`

### 1.3 Backend Requirements

**Endpoints required** (per `docs/api-purchases-expenses-taxes.md`):
- `POST /api/th/v1/purchases/orders/list`
- `POST /api/th/v1/purchases/orders/:id`
- `POST /api/th/v1/purchases/orders`
- `PUT /api/th/v1/purchases/orders/:id`
- `POST /api/th/v1/purchases/orders/:id/confirm`
- `POST /api/th/v1/purchases/orders/:id/cancel`

**Odoo Model**: Should connect to `purchase.order` model in Odoo.

**API Key Scope**: Requires `purchases` scope (add to API client configuration).

### 1.4 Verification Checklist

- [ ] Backend exposes `/api/th/v1/purchases/orders/*` endpoints
- [ ] API key has `purchases` scope
- [ ] Test `listPurchaseOrders()` returns data
- [ ] Test create/update/confirm/cancel operations
- [ ] Dashboard card displays purchase orders stats correctly
- [ ] Purchase Orders list page displays data correctly
- [ ] Navigation works (clicking card navigates to list page)

---

## 2. Partners API (Customers/Vendors)

### 2.1 Frontend Implementation ✅

- **Service**: `src/api/services/partners.service.ts`
  - ✅ `listPartners()` - List with search/filters (company_type, active)
  - ✅ `getPartner()` - Get single partner
  - ✅ `createPartner()` - Create new partner
  - ✅ `updatePartner()` - Update existing partner
  - ✅ `archivePartner()` / `unarchivePartner()` - Archive/unarchive
  - ✅ `setPartnerActive()` / `setPartnersActive()` - Bulk operations
- **Endpoints**: Uses `/api/th/v1/partners/*`
- **UI Pages**:
  - ✅ `src/features/customers/CustomersListPage.tsx` - List page
  - ✅ `src/features/customers/CustomerDetailPage.tsx` - Detail page
  - ✅ `src/features/customers/CustomerFormPage.tsx` - Create/edit form
  - ✅ Routes: `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit`

### 2.2 Partners vs Customers/Vendors

**Current Implementation**:
- Partners API uses **single endpoint** `/api/th/v1/partners/*`
- Distinguishes partners by `company_type`: `'company'` or `'person'`
- Does **NOT** explicitly distinguish customer vs vendor in the API

**Odoo Model**: Should connect to `res.partner` model in Odoo, which has:
- `is_company` - Boolean (company vs person)
- `customer_rank` - Integer (0 if not a customer, >0 if customer)
- `supplier_rank` - Integer (0 if not a vendor, >0 if vendor)

**Note**: In Odoo, a partner can be both a customer and a vendor simultaneously.

### 2.3 API Contract

Per `docs/api_contract.md`:
- Partners are exposed under `/api/th/v1/partners/*`
- Uses JSON-RPC 2.0 format
- Returns `ApiEnvelope<T>` with camelCase fields
- Fields: `id`, `name`, `vat`, `phone`, `email`, `active`, `companyType`, etc.

### 2.4 Backend Requirements

**Endpoints required**:
- `POST /api/th/v1/partners/list` - List partners with filters
- `POST /api/th/v1/partners/:id` - Get partner detail
- `POST /api/th/v1/partners/create` - Create partner
- `POST /api/th/v1/partners/:id/update` - Update partner

**Odoo Model**: Should query `res.partner` model.

**Optional Enhancements** (for better customer/vendor separation):
- Filter by `customer_rank > 0` for customers
- Filter by `supplier_rank > 0` for vendors
- Add `isCustomer` / `isVendor` fields to response
- Separate endpoints `/api/th/v1/customers/*` and `/api/th/v1/vendors/*` (future)

**API Key Scope**: Requires `contacts` scope (already configured).

### 2.5 Verification Checklist

- [ ] Backend exposes `/api/th/v1/partners/*` endpoints
- [ ] API key has `contacts` scope
- [ ] Test `listPartners()` returns data from `res.partner`
- [ ] Test create/update operations create/update `res.partner` records
- [ ] Partners can be filtered by `company_type` (company/person)
- [ ] Partners can be filtered by `active` (active/archived)
- [ ] Customer list page displays partners correctly
- [ ] Customer detail page shows partner information
- [ ] Customer form can create/edit partners
- [ ] Archive/unarchive operations work

---

## 3. UI Verification

### 3.1 Purchase Orders UI ✅

- ✅ Purchase Orders List Page (`/purchases/orders`)
  - Tabs for status filtering (all, draft, sent, to_approve, purchase, done, cancel)
  - Search box for number/vendor
  - DataTable with columns: number, vendor, orderDate, expectedDate, total, status
  - Infinite scroll pagination
  - Status badges with appropriate colors
  - Clicking number navigates to detail (route exists, detail page TBD)

- ✅ Dashboard Purchase Orders Card
  - Shows count of active orders (done + purchase status)
  - Shows total value
  - Clickable card navigates to `/purchases/orders`
  - Loading and error states handled

### 3.2 Partners/Customers UI ✅

- ✅ Customers List Page (`/customers`)
  - Tabs for status (active, archived, all)
  - Filter by company type (all, company, person)
  - Search box for name/VAT/phone/email
  - DataTable with columns: name, vat, phone, email, active, companyType
  - Bulk archive/unarchive operations
  - Clicking name navigates to detail

- ✅ Customer Detail Page (`/customers/:id`)
  - Shows partner information (name, VAT, contact info, address)
  - Quick actions (create invoice, edit)
  - Navigation to related invoices (if available)

- ✅ Customer Form Page (`/customers/new`, `/customers/:id/edit`)
  - Form fields: company_type, name, VAT, phone, email, mobile, address fields
  - Country selector
  - Create and update operations
  - Navigation back to list or detail

### 3.3 Navigation ✅

- ✅ App Layout includes navigation items:
  - "ลูกค้า" (Customers) - `/customers` (scope: `contacts`)
  - "ใบสั่งซื้อ" (Purchase Orders) - `/purchases/orders` (scope: `purchases`)
- ✅ Dashboard cards link to respective pages
- ✅ List pages link to detail pages
- ✅ Detail pages link to edit pages

---

## 4. Testing Recommendations

### 4.1 Purchase Orders Testing

1. **Backend API Test**:
   ```bash
   # List purchase orders
   curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/orders/list?db=q01" \
     -H "X-ADT-API-Key: <key>" \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"call","params":{"limit":10,"offset":0},"id":1}'
   ```

2. **Frontend UI Test**:
   - Navigate to Dashboard → Verify Purchase Orders card displays
   - Click Purchase Orders card → Verify navigates to list page
   - Check list page displays data (if backend is ready)
   - Test search and filter functionality
   - Test pagination (load more)

### 4.2 Partners/Customers Testing

1. **Backend API Test**:
   ```bash
   # List partners
   curl -i -X POST "http://127.0.0.1:18069/api/th/v1/partners/list?db=q01" \
     -H "X-ADT-API-Key: <key>" \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"call","params":{"limit":10,"offset":0},"id":1}'
   ```

2. **Frontend UI Test**:
   - Navigate to Customers list → Verify displays partners from `res.partner`
   - Create new customer → Verify creates `res.partner` record in Odoo
   - Edit customer → Verify updates `res.partner` record
   - Archive/unarchive → Verify sets `active` field in `res.partner`
   - Search and filter → Verify filters work correctly
   - Navigate to detail page → Verify shows correct partner data

---

## 5. Known Limitations & Future Enhancements

### 5.1 Purchase Orders

- ⚠️ **Detail page not implemented** - Currently only list page exists
- ⚠️ **Form page not implemented** - Cannot create/edit purchase orders from UI yet
- ⚠️ **Actions not implemented** - Confirm/cancel buttons not in list page
- ✅ **Backend API contract defined** - See `docs/api-purchases-expenses-taxes.md`

### 5.2 Partners/Customers

- ⚠️ **Customer vs Vendor distinction** - Partners API doesn't explicitly filter by customer_rank/supplier_rank
  - Workaround: All partners are shown; can be filtered manually by company_type
  - Future: Add `isCustomer`/`isVendor` fields or separate endpoints
- ⚠️ **Vendor-specific UI** - No separate vendor list page (uses same customers page)
  - Future: Add vendor filter or separate vendor pages
- ✅ **res.partner integration** - Should work correctly if backend maps correctly

---

## 6. Summary

### ✅ Completed

1. **Purchase Orders API Frontend**:
   - Service layer implemented
   - List page UI implemented
   - Dashboard card added
   - Routes and navigation configured

2. **Partners API Frontend**:
   - Service layer implemented (reuses existing code)
   - Customer list/detail/form pages implemented
   - Routes and navigation configured

### ⚠️ Pending Backend Verification

1. **Purchase Orders Backend**:
   - Verify `/api/th/v1/purchases/orders/*` endpoints exist
   - Verify API key has `purchases` scope
   - Test CRUD operations
   - Test connects to `purchase.order` model

2. **Partners Backend**:
   - Verify `/api/th/v1/partners/*` endpoints exist and work
   - Verify connects to `res.partner` model
   - Verify create/update operations persist to Odoo
   - Test customer/vendor distinction (if needed)

### 📝 Next Steps

1. Test Purchase Orders API on backend
2. Test Partners API on backend
3. Implement Purchase Order detail page
4. Implement Purchase Order form page
5. Add customer/vendor distinction if needed
6. Add vendor-specific UI if needed

