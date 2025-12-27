# Purchase Requests API Verification

This document verifies that Purchase Requests API is properly implemented and connects to Odoo `purchase_request` module correctly.

## 1. Odoo Purchase Request Module

### 1.1 Overview

The **Purchase Request** module (`purchase_request`) is an Odoo addon that provides:
- Internal request workflow for purchasing goods/services
- Multi-level approval workflow
- Integration with Purchase Orders (convert approved requests to PO)
- Request tracking and management

### 1.2 Key Odoo Models

- **`purchase.request`**: Main model for purchase requests
  - Fields: `name` (request number), `requested_by` (user), `date_start`, `date_required`, `state`, etc.
- **`purchase.request.line`**: Request line items
  - Fields: `product_id`, `description`, `product_qty`, `estimated_cost`, `uom_id`, etc.

### 1.3 State Workflow

Typical states in `purchase_request` module:
- `draft` - Draft request (can be edited)
- `to_approve` - Submitted, waiting for approval
- `approved` - Approved, ready to convert to PO
- `rejected` - Rejected by approver
- `done` - Converted to Purchase Order
- `cancel` - Cancelled

---

## 2. Frontend Implementation ✅

### 2.1 API Service

- **Service**: `src/api/services/purchase-requests.service.ts`
  - ✅ `listPurchaseRequests()` - List with filters/pagination
  - ✅ `getPurchaseRequest()` - Get single request
  - ✅ `createPurchaseRequest()` - Create new request
  - ✅ `updatePurchaseRequest()` - Update existing request (draft only)
  - ✅ `submitPurchaseRequest()` - Submit for approval
  - ✅ `approvePurchaseRequest()` - Approve request
  - ✅ `rejectPurchaseRequest()` - Reject request (with reason)
  - ✅ `cancelPurchaseRequest()` - Cancel request
  - ✅ `convertToPurchaseOrder()` - Convert approved request to PO
- **Endpoints**: `src/api/endpoints/purchase-requests.ts` - Re-exports

### 2.2 TypeScript Types

```typescript
export interface PurchaseRequestLine {
  productId: number | null
  description: string
  quantity: number
  estimatedCost?: number
  uomId?: number | null
  note?: string
}

export interface PurchaseRequest {
  id: number
  name?: string // Request number (e.g., PR001)
  requestorId?: number
  requestorName?: string
  requestedDate: string // ISO 8601
  requiredDate?: string // ISO 8601
  state: 'draft' | 'to_approve' | 'approved' | 'rejected' | 'done' | 'cancel'
  approverId?: number | null
  approverName?: string | null
  approvalDate?: string | null
  rejectedReason?: string | null
  purchaseOrderId?: number | null
  purchaseOrderName?: string | null
  lines: PurchaseRequestLine[]
  totalEstimatedCost?: number
  createdAt: string
  updatedAt: string
}
```

### 2.3 UI Pages

- ✅ **List Page**: `src/features/purchases/PurchaseRequestsListPage.tsx`
  - Tabs for status filtering (all, draft, to_approve, approved, done, rejected, cancel)
  - Search box for request number/requestor
  - DataTable with columns: number, requestor, requested date, required date, estimated cost, status, related PO
  - Infinite scroll pagination
  - Status badges with appropriate colors
  - Clicking request number navigates to detail (route exists, detail page TBD)

- ✅ **Routes**: Added to `src/App.tsx`
  - `/purchases/requests` → PurchaseRequestsListPage

- ✅ **Navigation**: Added to `src/components/layout/AppLayout.tsx`
  - "คำขอซื้อ" (Purchase Requests) menu item with icon `bi-clipboard-check`
  - Scope: `purchases`

---

## 3. Backend Requirements

### 3.1 API Endpoints

The backend (`adt_th_api`) should expose the following endpoints:

**Base path**: `/api/th/v1/purchases/requests`

#### List Purchase Requests
- **Endpoint**: `POST /api/th/v1/purchases/requests/list`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**:
  ```ts
  {
    state?: 'draft' | 'to_approve' | 'approved' | 'rejected' | 'done' | 'cancel'
    requestorId?: number
    search?: string
    dateFrom?: string  // ISO 8601
    dateTo?: string    // ISO 8601
    limit?: number     // Default: 50
    offset?: number    // Default: 0
  }
  ```
- **Response**: `ApiEnvelope<PurchaseRequestListItem[]>`

#### Get Purchase Request
- **Endpoint**: `POST /api/th/v1/purchases/requests/:id`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number }`
- **Response**: `ApiEnvelope<PurchaseRequest>`

#### Create Purchase Request
- **Endpoint**: `POST /api/th/v1/purchases/requests`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `PurchaseRequestPayload`
- **Response**: `ApiEnvelope<PurchaseRequest>`

#### Update Purchase Request
- **Endpoint**: `PUT /api/th/v1/purchases/requests/:id`
- **Method**: `PUT` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number } & PurchaseRequestPayload`
- **Response**: `ApiEnvelope<PurchaseRequest>`
- **Rule**: Only `draft` requests can be updated

#### Submit Purchase Request
- **Endpoint**: `POST /api/th/v1/purchases/requests/:id/submit`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number }`
- **Response**: `ApiEnvelope<PurchaseRequest>`
- **Rule**: Transitions from `draft` to `to_approve`

#### Approve Purchase Request
- **Endpoint**: `POST /api/th/v1/purchases/requests/:id/approve`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number }`
- **Response**: `ApiEnvelope<PurchaseRequest>`
- **Rule**: Transitions from `to_approve` to `approved`

#### Reject Purchase Request
- **Endpoint**: `POST /api/th/v1/purchases/requests/:id/reject`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number, reason?: string }`
- **Response**: `ApiEnvelope<PurchaseRequest>`
- **Rule**: Transitions from `to_approve` to `rejected`

#### Cancel Purchase Request
- **Endpoint**: `POST /api/th/v1/purchases/requests/:id/cancel`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number }`
- **Response**: `ApiEnvelope<PurchaseRequest>`

#### Convert to Purchase Order
- **Endpoint**: `POST /api/th/v1/purchases/requests/:id/convert-to-po`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number, vendorId: number, orderDate?: string, expectedDate?: string }`
- **Response**: `ApiEnvelope<{ purchaseRequestId: number, purchaseOrderId: number, purchaseOrderName?: string }>`
- **Rule**: Only `approved` requests can be converted

### 3.2 Odoo Model Mapping

The backend should map API fields to Odoo `purchase_request` model fields:

| API Field | Odoo Field | Notes |
|-----------|------------|-------|
| `name` | `purchase.request.name` | Request number (auto-generated) |
| `requestorId` | `purchase.request.requested_by` | User ID (defaults to current user) |
| `requestedDate` | `purchase.request.date_start` | ISO 8601 date |
| `requiredDate` | `purchase.request.date_required` | ISO 8601 date |
| `state` | `purchase.request.state` | Current state |
| `approverId` | `purchase.request.approver_id` | User who approved |
| `approvalDate` | `purchase.request.approved_date` | When approved |
| `rejectedReason` | `purchase.request.rejected_reason` | Rejection reason |
| `purchaseOrderId` | `purchase.request.purchase_order_id` | Related PO |
| `lines` | `purchase.request.line_ids` | Request lines |
| `line.productId` | `purchase.request.line.product_id` | Product |
| `line.description` | `purchase.request.line.name` | Description |
| `line.quantity` | `purchase.request.line.product_qty` | Quantity |
| `line.estimatedCost` | `purchase.request.line.estimated_cost` | Estimated cost |
| `line.uomId` | `purchase.request.line.product_uom_id` | Unit of measure |

### 3.3 State Transitions

The backend should enforce proper state transitions:

```
draft → submit() → to_approve → approve() → approved → convertToPurchaseOrder() → done
                                          → reject() → rejected
draft → cancel() → cancel
```

**Validation rules**:
- Only `draft` requests can be updated
- Only `draft` requests can be submitted
- Only `to_approve` requests can be approved/rejected
- Only `approved` requests can be converted to PO
- Any state (except `done`) can be cancelled

### 3.4 API Key Scope

Requires `purchases` scope (same as Purchase Orders).

---

## 4. Integration with Odoo purchase_request Module

### 4.1 Module Installation

The Odoo backend must have the `purchase_request` module installed:
1. Install via Odoo Apps menu
2. Configure approval workflow (if multi-level)
3. Set up user permissions

### 4.2 Backend Controller Requirements

The `adt_th_api` module should:

1. **Create controller** under `/api/th/v1/purchases/requests/*`:
   - Query `purchase.request` model
   - Handle state transitions via Odoo methods
   - Map Odoo fields to camelCase API fields

2. **State transition methods**:
   - `submit()` → Call `purchase.request.button_to_approve()`
   - `approve()` → Call `purchase.request.button_approved()`
   - `reject()` → Call `purchase.request.button_rejected()` with reason
   - `cancel()` → Call `purchase.request.button_cancelled()`
   - `convertToPurchaseOrder()` → Create `purchase.order` from request lines

3. **Field mapping**:
   - Convert `snake_case` Odoo fields to `camelCase` in responses
   - Handle date formatting (ISO 8601)
   - Include related data (requestor name, approver name, PO name)

### 4.3 Convert to Purchase Order

When converting an approved request to PO:
1. Create `purchase.order` with specified vendor
2. Create `purchase.order.line` from `purchase.request.line`
3. Link PO to request via `purchase.request.purchase_order_id`
4. Update request state to `done`
5. Return created PO ID and name

---

## 5. Testing Checklist

### 5.1 Frontend UI Testing

- [ ] Navigate to `/purchases/requests` → List page displays
- [ ] Search functionality works
- [ ] Filter by status (tabs) works
- [ ] Pagination (load more) works
- [ ] Status badges display correctly
- [ ] Clicking request number navigates (detail page TBD)

### 5.2 Backend API Testing

```bash
# List purchase requests
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/requests/list?db=q01" \
  -H "X-ADT-API-Key: <key>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"limit":10,"offset":0},"id":1}'

# Create purchase request
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/requests?db=q01" \
  -H "X-ADT-API-Key: <key>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"requestedDate":"2025-12-21","lines":[{"productId":1,"description":"Test product","quantity":10}]},"id":1}'

# Submit for approval
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/requests/1/submit?db=q01" \
  -H "X-ADT-API-Key: <key>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"id":1},"id":1}'

# Approve request
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/requests/1/approve?db=q01" \
  -H "X-ADT-API-Key: <key>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"id":1},"id":1}'

# Convert to Purchase Order
curl -i -X POST "http://127.0.0.1:18069/api/th/v1/purchases/requests/1/convert-to-po?db=q01" \
  -H "X-ADT-API-Key: <key>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"call","params":{"id":1,"vendorId":123,"orderDate":"2025-12-21"},"id":1}'
```

### 5.3 Odoo Integration Testing

- [ ] Verify `purchase_request` module is installed
- [ ] Create request via API → Verify record exists in Odoo `purchase.request`
- [ ] Submit request → Verify state changes to `to_approve`
- [ ] Approve request → Verify state changes to `approved`
- [ ] Convert to PO → Verify `purchase.order` created and linked
- [ ] Verify request state changes to `done` after conversion
- [ ] Test rejection flow → Verify state changes to `rejected` with reason
- [ ] Test cancellation → Verify state changes to `cancel`

---

## 6. Known Limitations & Future Enhancements

### 6.1 Current Limitations

- ⚠️ **Detail page not implemented** - Currently only list page exists
- ⚠️ **Form page not implemented** - Cannot create/edit purchase requests from UI yet
- ⚠️ **Actions not implemented** - Submit/approve/reject buttons not in list page
- ⚠️ **Convert to PO UI** - No UI for converting approved requests to PO

### 6.2 Future Enhancements

- Add Purchase Request detail page
- Add Purchase Request form page (create/edit)
- Add action buttons (submit, approve, reject, cancel, convert)
- Add multi-level approval workflow support
- Add approval history tracking
- Add email notifications for approval requests

---

## 7. Summary

### ✅ Completed

1. **Purchase Requests API Frontend**:
   - Service layer implemented (all CRUD + state transitions + convert)
   - List page UI implemented
   - Routes and navigation configured

2. **TypeScript Types**:
   - Complete type definitions for requests, lines, and payloads
   - State types match Odoo `purchase_request` states

### ⚠️ Pending Backend Implementation

1. **Backend API Endpoints**:
   - Implement `/api/th/v1/purchases/requests/*` endpoints
   - Connect to Odoo `purchase_request` model
   - Handle state transitions correctly
   - Implement convert to PO functionality

2. **Odoo Module**:
   - Ensure `purchase_request` module is installed
   - Configure approval workflow if needed
   - Set up user permissions

### 📝 Next Steps

1. Implement backend API endpoints
2. Test integration with Odoo `purchase_request` module
3. Implement Purchase Request detail page
4. Implement Purchase Request form page
5. Add action buttons to list/detail pages
6. Test complete workflow (create → submit → approve → convert)

