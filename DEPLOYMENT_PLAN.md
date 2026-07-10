# Sales Quotation Deployment Plan

## Goal
Ship the quotation create/edit flow with production attachment upload support and keep backward compatibility with older backend deployments.

## Deployment order
1. Deploy the backend Odoo controller update for sales-order attachment upload/delete.
2. Deploy the frontend React build with the updated sales quotation flow.
3. Verify create/edit/print flows against a staging company instance.
4. Promote to production only after upload, delete, and detail view checks pass.

## Backend changes
- Add sales-order attachment upload route
- Add sales-order attachment delete route
- Return attachment metadata including id and download URL in sale order detail
- Keep existing sales-order create/update/confirm behavior intact

## Frontend changes
- Upload files after save/update, not inside the JSON payload
- Keep `File` objects only in UI state
- Store draft attachments as metadata only
- Show attachment preview/download/remove actions
- Show attachment names in print views

## Rollout checklist
- [ ] Confirm API key, bearer token, and `X-Instance-ID` headers still work
- [ ] Confirm sales-order create/edit/save works with no customer
- [ ] Confirm attachment upload returns attachment records
- [ ] Confirm attachment delete removes the backend file
- [ ] Confirm detail page reload shows uploaded attachments
- [ ] Confirm print preview and HTML print include attachment names
- [ ] Confirm PDF download still works for saved quotations
- [ ] Confirm the invoice fallback still blocks unsafe paths without a customer

## Rollback plan
- If attachment upload fails in production, disable the new backend endpoints and the frontend will still allow quotation save.
- Existing quotation data remains safe because attachments are not mixed into the JSON payload.

## Post-deploy monitoring
- Watch sales-order create/update errors
- Watch upload/delete attachment errors
- Watch 404/405/500 rates on `/api/th/v1/sales/orders/*`
- Verify there are no new unauthorized or scope-forbidden spikes

