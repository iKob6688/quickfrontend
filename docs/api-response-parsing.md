# API Response Parsing - JSON-RPC Format

## Odoo Backend Response Format

Odoo `type="json"` routes wrap responses in JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": true,
    "data": [...],  // ← Actual data (array or object)
    "error": null
  }
}
```

## Frontend Parsing Flow

Frontend uses `unwrapResponse<T>()` helper in `src/api/response.ts` to extract the data:

### Step-by-step parsing:

1. **Axios receives response:**
   ```typescript
   const response = await apiClient.post('/api/th/v1/purchases/orders/list', body)
   // response.data = { jsonrpc: "2.0", result: { success: true, data: [...] } }
   ```

2. **normalizeEnvelope() extracts result:**
   ```typescript
   const envelope = normalizeEnvelope<T>(response.data)
   // envelope = { success: true, data: [...] }
   ```

3. **unwrapResponse() returns data:**
   ```typescript
   const data = unwrapResponse<PurchaseOrderListItem[]>(response)
   // data = [...] (array of purchase orders)
   ```

### Code path:
```
response.data
  → normalizeEnvelope()  // Extracts: response.data.result
  → unwrapResponse()     // Extracts: envelope.data
  → Returns: actual data array/object
```

## Example Usage

```typescript
// In purchases.service.ts
export async function listPurchaseOrders(params?: ListPurchaseOrdersParams) {
  const body = makeRpc({ ...params })
  const response = await apiClient.post(`${basePath}/list`, body)
  const data = unwrapResponse<PurchaseOrderListItem[]>(response)
  // data is now PurchaseOrderListItem[] array directly
  return data
}
```

## Error Handling

If backend returns error:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": false,
    "data": null,
    "error": {
      "message": "Invalid API key",
      "code": null,
      "details": null
    }
  }
}
```

Frontend will:
1. `normalizeEnvelope()` returns `{ success: false, error: {...} }`
2. `unwrapResponse()` throws `ApiError` with the error message

## Verification

To verify the parsing works correctly, check browser DevTools → Network tab:
- Request: `POST /api/th/v1/purchases/orders/list`
- Response Preview should show JSON-RPC format
- Frontend should extract `result.data` automatically

## Notes

- ✅ Frontend already handles JSON-RPC format correctly
- ✅ No changes needed in service files (they use `unwrapResponse` helper)
- ✅ All API endpoints use the same parsing logic
- ✅ Supports both JSON-RPC and plain envelope formats (backwards compatible)

