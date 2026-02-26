# Workflow Coverage Matrix (User Journey vs System Coverage)

## Quote-to-Cash (Sales)

| Step | React UI Coverage | `adt_th_api` Coverage | Odoo Model/Behavior | Coverage | Gap / Action |
|---|---|---|---|---|---|
| Search/select customer | Yes (`customers`, selectors in forms) | Yes (`auth`, partners/customer APIs) | `res.partner` | Partial | Improve inline create/edit UX |
| Search/select product | Yes (`products`, selectors) | Yes (`api_products`) | `product.template` / `product.product` | Partial | Add inline create modal in sales flow |
| Create quotation | Yes (`SalesOrderFormPage`) | Yes (`api_sales_orders`) | `sale.order` (draft/sent) | Yes/Partial | Need autosave + stronger UX validation |
| Confirm quotation -> SO | Partial in UI | Yes (`/sales/orders/<id>/confirm`) | `sale.order.action_confirm()` | Partial | Surface explicit continuation CTA |
| Delivery / stock picking | Not found in React | Not clearly exposed in `adt_th_api` | `stock.picking` / stock moves | Missing | Add stock workflow UI + API |
| Create invoice from SO | Not obvious in React | No explicit endpoint confirmed in `api_sales_orders` | Invoicing policy in Odoo | Missing/Fragile | Add explicit idempotent endpoint + UI CTA |
| Post invoice | Yes (`InvoiceDetailPage`) | Yes (`api_sales_invoices`) | `account.move` post | Yes | Validate safeguards and errors |
| Register payment | Yes (`RegisterPaymentModal`) | Yes (`api_sales_invoices` payment endpoint) | `account.payment` / payment register | Partial | Add split/allocation UX |
| Issue receipt | Partial (receipt templates in invoice page) | Partial via reports/pdf route | Odoo invoice/receipt templates | Partial | Validate legal/format correctness matrix |
| Print PDF (quotation/invoice/receipt) | Yes | Yes/Partial | QWeb / Reports Studio | Partial | Field completeness and template governance |

## Procure-to-Pay (Purchases)

| Step | React UI Coverage | `adt_th_api` Coverage | Odoo Model/Behavior | Coverage | Gap / Action |
|---|---|---|---|---|---|
| Create purchase request | Yes | Yes (`api_purchase_requests`) | `purchase.request` | Yes | Improve UX for conversion visibility |
| Approve/reject PR | Yes | Yes | Approval flow/custom rules | Yes/Partial | Verify role permissions and audit |
| Convert PR -> PO | Partial (service supports convert) | Verify endpoint in backend mapping | `purchase.order` creation | Partial | Add visible CTA and clear state |
| Create/confirm PO | Yes | Yes (`api_purchase_orders`) | `purchase.order.button_confirm` | Yes/Partial | Validate tax/journal defaults |
| Goods receipt / receive products | Not found | Not clearly exposed | `stock.picking` incoming | Missing | P0/P1 implementation gap |
| Vendor bill from PO/receipt | Not clearly surfaced | Not explicitly mapped in current frontend | `account.move` vendor bill | Missing/Partial | Add payable workflow UI/API |
| Payment to vendor | Not in current React purchase flow | Unknown/partial via generic accounting | `account.payment` | Missing/Partial | Define roadmap post receiving |

## Accounting & Reporting

| Step | React UI Coverage | `adt_th_api` Coverage | Odoo Dynamic Report Coverage | Coverage | Gap / Action |
|---|---|---|---|---|---|
| Profit & Loss | Yes | Yes | Yes (`adt_dynamic_accounting_report`) | Partial | Dynamic date/filter fragility |
| Balance Sheet | Yes | Yes | Yes | Partial | Same filter issues |
| General Ledger | Yes | Yes + account drilldown | Yes | Partial | Contract alignment for drilldown |
| Partner Ledger | Yes | Yes + fallback for missing WHT column | Yes (fragile with schema drift) | Partial | Add dynamic UI fallback/guards |
| Trial Balance | Yes | Yes | Yes | Partial | Filter contract standardization |
| VAT/WHT reports | Yes (React pages exist) | Yes (`api_tax_reports`) | Odoo tax reports modules | Partial | Export API + UX hardening |

## AI-Assisted Workflow (Target vs Current)

| Capability | Current | Target | Gap |
|---|---|---|---|
| Ask about customers/products | Basic via keyword tools | Natural language + grounded retrieval | Parser depth + retrieval strategy |
| Create quotation via assistant | Basic | Approval-safe, multi-step, disambiguation | Candidate selection, validation, richer prompts |
| Open report via assistant | Basic route open | Route + prefilled filters + explain results | Filter-aware actions |
| Execute PO/SO/invoice/payment workflows | Not supported | Tool-driven with approvals and audit | Missing tools/endpoints |
| Token usage visibility | Frontend-ready, backend inconsistent | Full usage in UI + backend logs | Backend response/log schema |

