# Chonlatee Billing Removal Inventory

Date: 2026-07-15

This inventory documents the Chonlatee Billing sweep performed to remove billing-specific ERPTH exposure while preserving generic invoice, receipt, accounting, and template capabilities.

| file | symbol | route | API endpoint | storage key | configuration | role/permission | database dependency | classification | removal action | migration action | verification result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `src/App.tsx` | `ChonlateeBillingFormPage` route | `/sales/invoices/chonlatee/new` | n/a | n/a | React route registration | `invoice` scope via parent shell | none | A. Chonlatee-specific | Removed route and import | Users now land on `/dashboard` via wildcard fallback if they hit the old path | Verified deleted from route table |
| `src/components/layout/AppLayout.tsx` | Sidebar sales child item | `/sales/invoices/chonlatee/new` | n/a | n/a | Nav item in sidebar tree | `invoice` scope | none | A. Chonlatee-specific | Removed nav entry | Sales menu now shows only generic invoice actions | Verified removed from desktop/sidebar navigation |
| `src/features/sales/InvoicesListPage.tsx` | Secondary create button | `/sales/invoices/chonlatee/new` | n/a | n/a | Page action button | `invoice` scope | none | A. Chonlatee-specific | Removed button and CTA copy | Retained generic `+ สร้างใบแจ้งหนี้` action | Verified removed from invoices list toolbar |
| `src/features/sales/ChonlateeBillingFormPage.tsx` | `ChonlateeBillingFormPage` | `/sales/invoices/chonlatee/new` | `POST /th/v1/chonlatee-billing/invoices/:id/initialize` | `['chonlatee-partner-selector', ...]`, `['chonlatee-partner', ...]` | Specialized billing workflow page | `invoice` scope | invoice, partner, employee user lookup | A. Chonlatee-specific | Deleted file | Generic invoice workflows remain in `InvoiceFormPage` | Verified file removed |
| `src/api/services/chonlatee-billing.service.ts` | `initializeChonlateeBillingInvoice` | n/a | `POST /th/v1/chonlatee-billing/invoices/:id/initialize` | n/a | RPC wrapper | n/a | invoice record | A. Chonlatee-specific | Deleted service | No replacement needed; initialization is no longer Chonlatee-specific | Verified file removed |
| `src/api/services/employee-users.service.ts` | Chonlatee employee lookup candidate | n/a | `/th/v1/chonlatee-billing/employees/list` | n/a | Candidate endpoint list | n/a | employee/user list | A. Chonlatee-specific | Removed Chonlatee-only backend candidate | Generic employee/user endpoint discovery remains intact | Verified endpoint removed from fallback list |
| `src/lib/reportTemplateDefaults.ts` | `CHONLATEE_DEFAULT_TEMPLATE_OVERRIDES`, `isChonlateeCompany` | n/a | n/a | n/a | Runtime default-template resolution | n/a | company name comparison | A. Chonlatee-specific | Removed special-case company override logic | Template defaults now resolve from generic settings and optional company overrides only | Verified special-case logic deleted |
| `src/app/core/storage/defaultTemplates.ts` | `invoice_chonlatee_billing_v1`, `receipt_full_chonlatee_tax_invoice_v1` | n/a | n/a | n/a | Default template catalog | n/a | template defaults | A. Chonlatee-specific | Removed Chonlatee-specific default templates | Generic invoice and receipt templates remain as defaults | Verified template entries removed |
| `src/app/core/storage/settingsStore.ts` | Template ID migration helper | n/a | n/a | `rs:settings:v1` | Persisted settings schema/merge | n/a | persisted studio settings | C. Mixed | Added migration mapping for stale Chonlatee template IDs | Old saved IDs now normalize to `invoice_default_v1` and `receipt_full_default_v1` | Verified sanitizer added |
| `src/components/icons/AppLogo.tsx` | App logo image | n/a | n/a | n/a | Shared app branding asset | n/a | static asset `public/chonlatee-logo.png` | B. Generic/shared branding retained | No deletion; shared app identity still references logo asset | Leave unchanged unless a full rebrand is requested | Verified retained |
| `src/features/auth/LoginPage.tsx` | Login mark | n/a | n/a | n/a | Shared login branding | n/a | static asset `public/chonlatee-logo.png` | B. Generic/shared branding retained | No deletion; still part of shared login shell | Leave unchanged unless a full rebrand is requested | Verified retained |

## Notes

- The old Chonlatee Billing route now falls through to the app wildcard redirect instead of exposing a dedicated page.
- Generic invoice, receipt, accounting, and template functionality remains available.
- The settings migration prevents stale Chonlatee template IDs from lingering in persisted studio settings.
