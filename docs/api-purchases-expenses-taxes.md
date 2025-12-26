# Purchase Orders, Expenses & Taxes/VAT API Specification

This document defines the API contract for Purchase Orders, Expenses, and Taxes/VAT endpoints in the Quickfront18 React frontend.

- **Backend module**: `adt_th_api` (Odoo 18)
- **API base URL**: `/api/th/v1/`
- **Request format**: JSON-RPC 2.0 for `type="json"` routes
- **Response format**: `ApiEnvelope<T>` (unified response wrapper)

---

## 1. API Endpoints Specification

### 1.1 Purchase Orders

All endpoints under `/api/th/v1/purchases/orders`:

#### List Purchase Orders
- **Endpoint**: `POST /api/th/v1/purchases/orders/list`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**:
  ```ts
  {
    status?: 'draft' | 'sent' | 'to_approve' | 'purchase' | 'done' | 'cancel'
    vendorId?: number
    search?: string
    dateFrom?: string  // ISO 8601
    dateTo?: string    // ISO 8601
    limit?: number     // Default: 50
    offset?: number    // Default: 0
  }
  ```
- **Response**: `ApiEnvelope<PurchaseOrderListItem[]>`

#### Get Purchase Order
- **Endpoint**: `POST /api/th/v1/purchases/orders/:id`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number }`
- **Response**: `ApiEnvelope<PurchaseOrder>`

#### Create Purchase Order
- **Endpoint**: `POST /api/th/v1/purchases/orders`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `PurchaseOrderPayload`
- **Response**: `ApiEnvelope<PurchaseOrder>`

#### Update Purchase Order
- **Endpoint**: `PUT /api/th/v1/purchases/orders/:id`
- **Method**: `PUT` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number } & PurchaseOrderPayload`
- **Response**: `ApiEnvelope<PurchaseOrder>`

#### Confirm Purchase Order
- **Endpoint**: `POST /api/th/v1/purchases/orders/:id/confirm`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number }`
- **Response**: `ApiEnvelope<PurchaseOrder>`

#### Cancel Purchase Order
- **Endpoint**: `POST /api/th/v1/purchases/orders/:id/cancel`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number, reason?: string }`
- **Response**: `ApiEnvelope<PurchaseOrder>`

---

### 1.2 Expenses

All endpoints under `/api/th/v1/expenses`:

#### List Expenses
- **Endpoint**: `POST /api/th/v1/expenses/list`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**:
  ```ts
  {
    status?: 'draft' | 'reported' | 'approved' | 'posted' | 'done' | 'refused'
    employeeId?: number
    search?: string
    dateFrom?: string  // ISO 8601
    dateTo?: string    // ISO 8601
    limit?: number     // Default: 50
    offset?: number    // Default: 0
  }
  ```
- **Response**: `ApiEnvelope<ExpenseListItem[]>`

#### Get Expense
- **Endpoint**: `POST /api/th/v1/expenses/:id`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number }`
- **Response**: `ApiEnvelope<Expense>`

#### Create Expense
- **Endpoint**: `POST /api/th/v1/expenses`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `ExpensePayload`
- **Response**: `ApiEnvelope<Expense>`

#### Update Expense
- **Endpoint**: `PUT /api/th/v1/expenses/:id`
- **Method**: `PUT` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number } & ExpensePayload`
- **Response**: `ApiEnvelope<Expense>`

#### Submit Expense
- **Endpoint**: `POST /api/th/v1/expenses/:id/submit`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**: `{ id: number }`
- **Response**: `ApiEnvelope<Expense>`

---

### 1.3 Taxes & VAT

All endpoints under `/api/th/v1/taxes`:

#### List Taxes (Enhanced)
- **Endpoint**: `POST /api/th/v1/taxes/list`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**:
  ```ts
  {
    type?: 'sale' | 'purchase' | 'none'
    active?: boolean
    search?: string
    includeVat?: boolean  // Include/exclude VAT taxes
    limit?: number        // Default: 100
    offset?: number       // Default: 0
  }
  ```
- **Response**: `ApiEnvelope<TaxListItem[]>`

#### Calculate Tax
- **Endpoint**: `POST /api/th/v1/taxes/calculate`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**:
  ```ts
  {
    baseAmount: number
    taxIds: number[]  // Tax IDs to apply
    currency?: string // Default: THB
  }
  ```
- **Response**: `ApiEnvelope<TaxCalculationResult>`

#### Validate VAT Number
- **Endpoint**: `POST /api/th/v1/taxes/validate-vat`
- **Method**: `POST` (JSON-RPC)
- **Auth**: Bearer token required
- **Request params**:
  ```ts
  {
    vatNumber: string  // e.g., "0123456789012" (13 digits)
    countryCode?: string // Default: "TH"
  }
  ```
- **Response**: `ApiEnvelope<VatValidationResult>`

---

## 2. TypeScript Type Definitions

### 2.1 Purchase Orders

```typescript
export interface PurchaseOrderLine {
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  taxIds: number[]  // Array of tax IDs
  subtotal: number  // Calculated by Odoo
  totalTax: number  // Calculated by Odoo
  total: number     // Calculated by Odoo
}

export interface PurchaseOrderPayload {
  id?: number
  vendorId: number
  orderDate: string  // ISO 8601
  expectedDate?: string  // ISO 8601
  currency: string
  lines: PurchaseOrderLine[]
  notes?: string
}

export interface PurchaseOrder extends PurchaseOrderPayload {
  id: number
  number?: string
  vendorName?: string
  status: 'draft' | 'sent' | 'to_approve' | 'purchase' | 'done' | 'cancel'
  amountUntaxed: number
  totalTax: number
  total: number
  createdAt: string  // ISO 8601
  updatedAt: string  // ISO 8601
}

export interface PurchaseOrderListItem {
  id: number
  number: string
  vendorName: string
  vendorId: number
  orderDate: string  // ISO 8601
  expectedDate?: string  // ISO 8601
  total: number
  status: 'draft' | 'sent' | 'to_approve' | 'purchase' | 'done' | 'cancel'
  currency: string
}

export interface ListPurchaseOrdersParams {
  status?: 'draft' | 'sent' | 'to_approve' | 'purchase' | 'done' | 'cancel'
  vendorId?: number
  search?: string
  dateFrom?: string  // ISO 8601
  dateTo?: string    // ISO 8601
  limit?: number
  offset?: number
}
```

### 2.2 Expenses

```typescript
export interface ExpenseLine {
  productId: number | null
  description: string
  quantity: number
  unitPrice: number
  taxId?: number | null
  subtotal: number  // Calculated by Odoo
  totalTax: number  // Calculated by Odoo
  total: number     // Calculated by Odoo
}

export interface ExpensePayload {
  id?: number
  employeeId?: number  // Optional, defaults to current user
  expenseDate: string  // ISO 8601
  currency: string
  lines: ExpenseLine[]
  notes?: string
}

export interface Expense extends ExpensePayload {
  id: number
  number?: string
  employeeName?: string
  status: 'draft' | 'reported' | 'approved' | 'posted' | 'done' | 'refused'
  amountUntaxed: number
  totalTax: number
  total: number
  createdAt: string  // ISO 8601
  updatedAt: string  // ISO 8601
}

export interface ExpenseListItem {
  id: number
  number: string
  employeeName: string
  employeeId: number
  expenseDate: string  // ISO 8601
  total: number
  status: 'draft' | 'reported' | 'approved' | 'posted' | 'done' | 'refused'
  currency: string
}

export interface ListExpensesParams {
  status?: 'draft' | 'reported' | 'approved' | 'posted' | 'done' | 'refused'
  employeeId?: number
  search?: string
  dateFrom?: string  // ISO 8601
  dateTo?: string    // ISO 8601
  limit?: number
  offset?: number
}
```

### 2.3 Taxes & VAT

```typescript
export interface Tax {
  id: number
  name: string
  amount: number  // Tax percentage (e.g., 7 for 7%)
  type: 'percent' | 'fixed' | 'group'
  typeTaxUse: 'sale' | 'purchase' | 'none'
  active: boolean
  vatCode?: string  // VAT code (e.g., "VAT7" for 7% VAT)
  accountId?: number
  refundAccountId?: number
}

export interface TaxListItem {
  id: number
  name: string
  amount: number
  type: 'percent' | 'fixed' | 'group'
  typeTaxUse: 'sale' | 'purchase' | 'none'
  active: boolean
  vatCode?: string
}

export interface TaxCalculationResult {
  baseAmount: number
  taxDetails: Array<{
    taxId: number
    taxName: string
    taxAmount: number  // Amount of tax
    taxBase: number    // Base amount for this tax
  }>
  totalTax: number
  total: number
  currency: string
}

export interface VatValidationResult {
  vatNumber: string
  isValid: boolean
  companyName?: string  // If valid, returns registered company name
  address?: string      // If valid, returns registered address
  errorCode?: string    // If invalid, error code
  errorMessage?: string // If invalid, error message
}

export interface ListTaxesParams {
  type?: 'sale' | 'purchase' | 'none'
  active?: boolean
  search?: string
  includeVat?: boolean
  limit?: number
  offset?: number
}
```

### 2.4 Unified Response Format

All endpoints return `ApiEnvelope<T>`:

```typescript
export interface ApiEnvelope<T> {
  success: boolean
  data?: T | null
  error?: ApiErrorPayload | null
}

export type ApiErrorPayload =
  | string
  | {
      code?: string
      message: string
      details?: unknown
    }
```

### 2.5 Error Handling Types

```typescript
export class ApiError extends Error {
  code?: string
  status?: number
  details?: unknown

  constructor(
    message: string,
    options?: { code?: string; status?: number; details?: unknown }
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = options?.code
    this.status = options?.status
    this.details = options?.details
  }
}
```

**Standard error codes**:
- `AUTH_REQUIRED`: Authentication token missing or invalid
- `AUTH_FORBIDDEN`: User lacks permission for this action
- `VALIDATION_ERROR`: Request payload validation failed
- `NOT_FOUND`: Resource not found (e.g., purchase order ID doesn't exist)
- `CONFLICT`: State conflict (e.g., cannot cancel already confirmed order)
- `INTERNAL_ERROR`: Server-side error

---

## 3. Implementation Guidelines

### 3.1 API Client Structure

Follow the existing pattern in `src/api/services/invoices.service.ts`:

1. **Service file location**: `src/api/services/purchases.service.ts`, `src/api/services/expenses.service.ts`, `src/api/services/taxes.service.ts`
2. **Endpoint file location**: `src/api/endpoints/purchases.ts`, `src/api/endpoints/expenses.ts`, `src/api/endpoints/taxes.ts`
3. **Base path**: Use namespace prefix (e.g., `/th/v1/purchases/orders`, `/th/v1/expenses`, `/th/v1/taxes`)
4. **RPC helper**: Use `makeRpc()` from `src/api/services/rpc.ts` for JSON-RPC requests
5. **Response unwrapping**: Use `unwrapResponse<T>()` from `src/api/response.ts`

**Example structure** (`src/api/services/purchases.service.ts`):

```typescript
import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

const basePath = '/th/v1/purchases/orders'

export async function listPurchaseOrders(params?: ListPurchaseOrdersParams) {
  const body = makeRpc({
    ...(params?.status && { status: params.status }),
    ...(params?.vendorId && { vendor_id: params.vendorId }),
    ...(params?.search && { search: params.search }),
    ...(params?.limit && { limit: params.limit }),
    ...(params?.offset && { offset: params.offset }),
    ...(params?.dateFrom && { date_from: params.dateFrom }),
    ...(params?.dateTo && { date_to: params.dateTo }),
  })
  const response = await apiClient.post(`${basePath}/list`, body)
  return unwrapResponse<PurchaseOrderListItem[]>(response)
}

export async function getPurchaseOrder(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}`, body)
  return unwrapResponse<PurchaseOrder>(response)
}

export async function createPurchaseOrder(payload: PurchaseOrderPayload) {
  const body = makeRpc(payload)
  const response = await apiClient.post(basePath, body)
  return unwrapResponse<PurchaseOrder>(response)
}

export async function updatePurchaseOrder(id: number, payload: PurchaseOrderPayload) {
  const body = makeRpc({ id, ...payload })
  const response = await apiClient.put(`${basePath}/${id}`, body)
  return unwrapResponse<PurchaseOrder>(response)
}

export async function confirmPurchaseOrder(id: number) {
  const body = makeRpc({ id })
  const response = await apiClient.post(`${basePath}/${id}/confirm`, body)
  return unwrapResponse<PurchaseOrder>(response)
}

export async function cancelPurchaseOrder(id: number, reason?: string) {
  const body = makeRpc({ id, ...(reason && { reason }) })
  const response = await apiClient.post(`${basePath}/${id}/cancel`, body)
  return unwrapResponse<PurchaseOrder>(response)
}
```

### 3.2 Authentication Pattern

All endpoints require Bearer token authentication:

- **Header**: `Authorization: Bearer <token>`
- **Automatic attachment**: Handled by `src/api/client.ts` request interceptor
- **401 handling**: Automatically handled by response interceptor (clears auth, redirects to login)
- **Token source**: `localStorage.getItem('qf18_access_token')`

**Required headers** (automatically added by `apiClient`):

```typescript
{
  'Authorization': `Bearer ${token}`,
  'X-Instance-ID': instanceId,  // Company scoping
  'X-ADT-API-Key': apiKey,      // API key from VITE_API_KEY
  'Content-Type': 'application/json'
}
```

### 3.3 Error Handling

1. **Use `unwrapResponse<T>()`**: Automatically throws `ApiError` on `success: false`
2. **Catch `ApiError`**: Handle specific error codes in UI
3. **Display user-friendly messages**: Map error codes to localized messages
4. **Log errors**: Use console.error or logging service for debugging

**Example**:

```typescript
try {
  const order = await getPurchaseOrder(id)
  // Use order...
} catch (error) {
  const apiError = toApiError(error)
  if (apiError.code === 'NOT_FOUND') {
    // Show "Purchase order not found" message
  } else if (apiError.code === 'VALIDATION_ERROR') {
    // Show validation errors from apiError.details
  } else {
    // Show generic error message
  }
}
```

### 3.4 Date Format

**Standard**: ISO 8601 date strings (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss.sssZ`)

- **Request**: Always send dates as ISO 8601 strings
- **Response**: Backend returns dates as ISO 8601 strings
- **Parsing**: Use `new Date(dateString)` for Date objects
- **Formatting**: Use `date.toISOString()` or `date.toISOString().split('T')[0]` for date-only fields

**Example**:

```typescript
// Creating a purchase order
const payload: PurchaseOrderPayload = {
  vendorId: 123,
  orderDate: new Date().toISOString().split('T')[0],  // "2025-12-21"
  expectedDate: '2025-12-31',
  currency: 'THB',
  lines: [...]
}
```

### 3.5 Testing Checklist

For each endpoint, verify:

- ✅ **Happy path**: Successful request returns `{ success: true, data: <expected> }`
- ✅ **Authentication**: Missing/invalid token returns `401` or `{ success: false, error: { code: 'AUTH_REQUIRED' } }`
- ✅ **Authorization**: Insufficient permissions returns `403` or `{ success: false, error: { code: 'AUTH_FORBIDDEN' } }`
- ✅ **Validation**: Invalid payload returns `400` or `{ success: false, error: { code: 'VALIDATION_ERROR', details: {...} } }`
- ✅ **Not found**: Non-existent ID returns `404` or `{ success: false, error: { code: 'NOT_FOUND' } }`
- ✅ **State conflicts**: Invalid state transitions (e.g., cancel confirmed order) return `409` or `{ success: false, error: { code: 'CONFLICT' } }`
- ✅ **Pagination**: List endpoints respect `limit`/`offset` and return correct counts
- ✅ **Company isolation**: Data from one company is not accessible to another (via `X-Instance-ID`)

---

## 4. Key Features

### 4.1 camelCase Responses (DTO-style)

All response fields use **camelCase** to align with React/TypeScript conventions:

- ✅ `vendorId` (not `vendor_id`)
- ✅ `orderDate` (not `order_date`)
- ✅ `totalTax` (not `total_tax`)
- ✅ `createdAt` (not `created_at`)

**Backend responsibility**: Convert Odoo `snake_case` fields to `camelCase` in API responses.

**Frontend responsibility**: Use camelCase in TypeScript interfaces and components.

### 4.2 Unified Response Format

All endpoints return `ApiEnvelope<T>`:

```typescript
{
  success: boolean
  data?: T | null
  error?: ApiErrorPayload | null
}
```

**Benefits**:
- Consistent error handling across all endpoints
- Easy to distinguish success/failure
- Structured error information (code, message, details)

### 4.3 Error Codes

Standard error codes for consistent error handling:

- `AUTH_REQUIRED`: Missing or invalid authentication token
- `AUTH_FORBIDDEN`: User lacks permission for the requested action
- `VALIDATION_ERROR`: Request payload failed validation (details contain field-level errors)
- `NOT_FOUND`: Requested resource does not exist
- `CONFLICT`: State conflict (e.g., cannot update confirmed order)
- `INTERNAL_ERROR`: Server-side error (should not happen in production)

**Example error response**:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "vendorId": "Vendor is required",
      "lines": "At least one line item is required"
    }
  }
}
```

### 4.4 Pagination Support

List endpoints support pagination via `limit`/`offset`:

- **Default limit**: 50 items per page
- **Default offset**: 0
- **Maximum limit**: Backend should enforce (e.g., 500)
- **Total count**: Backend may optionally return `totalCount` in response metadata (not required for v1)

**Example request**:

```typescript
const orders = await listPurchaseOrders({
  status: 'draft',
  limit: 20,
  offset: 0
})
```

**Future enhancement**: Consider adding `totalCount` and `hasMore` to list responses for better pagination UX.

### 4.5 Company Isolation

All endpoints automatically scope data by company via `X-Instance-ID` header:

- **Header**: `X-Instance-ID: <instance_public_id>`
- **Automatic attachment**: Added by `src/api/client.ts` request interceptor
- **Source**: `localStorage.getItem('qf18_instance_public_id')`
- **Backend responsibility**: Filter all queries by the current company (from `X-Instance-ID`)

**Example**: When user from Company A requests purchase orders, backend only returns orders for Company A, even if user has access to multiple companies.

### 4.6 State Management

**Recommended pattern**: Use React Query (`@tanstack/react-query`) or Zustand for:

- **Caching**: Cache list/detail responses
- **Optimistic updates**: Update UI immediately, revert on error
- **Invalidation**: Invalidate cache after create/update/delete operations
- **Background refetching**: Keep data fresh

**Example with React Query**:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

function usePurchaseOrders(params?: ListPurchaseOrdersParams) {
  return useQuery({
    queryKey: ['purchaseOrders', params],
    queryFn: () => listPurchaseOrders(params),
    staleTime: 30000, // 30 seconds
  })
}

function useConfirmPurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => confirmPurchaseOrder(id),
    onSuccess: () => {
      // Invalidate and refetch purchase orders
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] })
    },
  })
}
```

---

## 5. API Key Scopes

Add the following scopes to the API key configuration in Odoo:

- `purchases`: Access to purchase order endpoints
- `expenses`: Access to expense endpoints
- `taxes`: Access to tax and VAT endpoints

**Note**: If using **Custom scopes** policy, ensure the API key includes these scopes when creating/updating the API client in Odoo.

---

## 6. Backend Implementation Notes

For the Odoo backend team implementing these endpoints:

1. **Route registration**: Register routes in `adt_th_api` controllers under `/api/th/v1/purchases/*`, `/api/th/v1/expenses/*`, `/api/th/v1/taxes/*`
2. **JSON-RPC format**: Use Odoo `type="json"` routes (returns JSON-RPC 2.0 wrapped `ApiEnvelope`)
3. **Field mapping**: Convert Odoo `snake_case` to `camelCase` in responses
4. **Company scoping**: Use `X-Instance-ID` header to filter by company
5. **Error responses**: Return `ApiEnvelope` with `success: false` and appropriate error codes
6. **Date format**: Return dates as ISO 8601 strings
7. **Pagination**: Support `limit`/`offset` for list endpoints
8. **State validation**: Validate state transitions (e.g., cannot cancel confirmed order)

---

## 7. Frontend Integration Checklist

- [ ] Create `src/api/services/purchases.service.ts` with all purchase order functions
- [ ] Create `src/api/services/expenses.service.ts` with all expense functions
- [ ] Create `src/api/services/taxes.service.ts` with all tax/VAT functions
- [ ] Create `src/api/endpoints/purchases.ts` (re-export service functions and types)
- [ ] Create `src/api/endpoints/expenses.ts` (re-export service functions and types)
- [ ] Create `src/api/endpoints/taxes.ts` (re-export service functions and types)
- [ ] Add API key scopes: `purchases`, `expenses`, `taxes`
- [ ] Implement UI components for purchase orders list/detail
- [ ] Implement UI components for expenses list/detail
- [ ] Implement tax selection components (with VAT validation)
- [ ] Add state management (React Query or Zustand) for caching
- [ ] Add error handling and user-friendly error messages
- [ ] Add loading states and optimistic updates
- [ ] Test all endpoints with real backend
- [ ] Test pagination, filtering, and search
- [ ] Test company isolation (multi-tenant)

