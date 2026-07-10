# Sales Quotation Production Ready Checklist

## Scope
- Sales quotation / sale order create-edit flow
- Attachment upload, delete, preview, download
- Draft restore and autosave
- Print / PDF download
- Backend compatibility and fallbacks

## What is now covered
- Real attachment persistence through backend `ir.attachment`
- Local draft stores metadata only, never `File`
- Form submission never sends `File` objects in JSON payload
- Existing quotations can show saved attachments in detail view
- Users can preview, download, and remove attachments from the form
- Save/update still succeeds if attachment upload fails

## Backend endpoints used
- `POST /api/th/v1/sales/orders`
- `PUT /api/th/v1/sales/orders/:id`
- `POST /api/th/v1/sales/orders/:id/attachments/upload`
- `DELETE /api/th/v1/sales/orders/:id/attachments/:attachment_id`
- `POST /api/th/v1/sales/orders/:id/confirm`
- `GET /api/th/v1/sales/orders/:id/pdf`

## Validation checklist
- [ ] Create quotation without customer
- [ ] Create quotation without products
- [ ] Create quotation with note only
- [ ] Create quotation with free-text customer only
- [ ] Create quotation with description-only line
- [ ] Add section line
- [ ] Add note line
- [ ] Toggle VAT on and off
- [ ] Toggle withholding tax on and off
- [ ] Select attachments, preview, download, remove
- [ ] Save draft, restore draft, clear draft
- [ ] Edit existing quotation and verify free-text fields reload
- [ ] Print before save
- [ ] Download HTML before save
- [ ] Download PDF after save when backend supports it
- [ ] Confirm sale order path
- [ ] Invoice fallback path

## Acceptance notes
- Totals are calculated from the shared totals helper
- Section and note rows do not affect totals
- Internal notes are not printed
- Attachment metadata is persisted in draft only as name/url/size/type

## Remaining backend dependency
- Production readiness still depends on deploying the Odoo controller update in the companion backend source tree.
- Without that backend update, the UI will fall back to the warning path for file uploads.

