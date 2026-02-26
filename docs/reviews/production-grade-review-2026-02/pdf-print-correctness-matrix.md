# PDF / Print Correctness Matrix (Field-Level Review Plan)

## Objective

Verify that all business documents generated from React + Odoo contain correct, complete, and legally/operationally required information, and that totals match source records exactly.

## Documents In Scope

- Quotation
- Sale Order (if separately printed)
- Purchase Order
- Invoice / Tax Invoice
- Receipt (full / short)
- Credit Note / Amendment-related documents (if used)
- VAT / WHT reports (print/export formats)

## Field-Level Validation Matrix

| Document | Field Group | Validate | Source of Truth | Current Risk | Priority |
|---|---|---|---|---|---|
| Quotation | Customer details (name/address/tax ID/branch) | Present and correct | `sale.order.partner_id` + partner fields | User reported missing details in print | P0 |
| Quotation | Document metadata (number/date/validity/payment terms) | Present | `sale.order` | Template mismatch risk | P1 |
| Quotation | Line details (product/code/qty/uom/price/discount/tax) | Accurate | `sale.order.line` | Missing columns/formatting risk | P1 |
| Quotation | Totals (subtotal/VAT/grand total) | Match Odoo | computed totals | High trust-impact if wrong | P0 |
| SO | Confirmation status cues | Clear on print | `sale.order.state` | Confusion between quote vs order | P2 |
| PO | Vendor details + tax IDs | Present | `purchase.order.partner_id` | Common localization gap | P1 |
| PO | Ordered quantities and pricing | Accurate | `purchase.order.line` | Tax/journal defaults can affect totals | P1 |
| Invoice | Invoice type & legal labels | Correct | `account.move.move_type` | Legal/compliance risk | P0 |
| Invoice | Customer tax info / branch | Correct | partner | Thai tax format risk | P0 |
| Invoice | Tax lines / VAT breakdown | Correct and itemized | `account.move.line` taxes | High accounting risk | P0 |
| Invoice | Payment terms / due date | Present | invoice fields | Missing info affects collections | P1 |
| Receipt | Payment reference / date / method | Present | payment records | Split payment traceability gap | P1 |
| Receipt | Applied amount vs invoice balance | Correct | invoice/payment reconciliation | Partial-payment mismatch risk | P0 |
| Credit Note | Original invoice reference | Present | reversal linkage | Audit/legal traceability risk | P1 |
| VAT Report export | Date range / tax / company info | Correct | tax report wizard + report model | API export incomplete | P1 |
| WHT Report export | Form type / date range / totals | Correct | withholding report wizard/model | Export UX/API completeness risk | P1 |

## Template Governance Checks

| Check | Why | Action |
|---|---|---|
| Template source mapping documented (QWeb vs Reports Studio) | Avoid inconsistent outputs across environments | Create template registry doc and defaults |
| Fallback template behavior documented | Prevent broken print in production | Add explicit fallback sequence and warnings |
| Template versioning | Prevent silent regressions | Store template IDs + versions in settings/config |
| Locale formatting consistency | Thai/English mixed outputs can confuse users | Standardize date/currency/number formatting |

## PDF Verification Test Scenarios

1. Quotation with VAT + multiple lines + discounts.
2. Invoice from quotation with same lines and totals preserved.
3. Partial payment receipt after first payment and final receipt after settlement.
4. Amendment flow (credit note + replacement invoice) preserves audit trail in print.
5. Documents for customers with Thai tax ID + branch fields.
6. Zero-VAT / non-VAT customer scenario (if supported).

## Acceptance Criteria

- Printed totals always reconcile to Odoo source records.
- Required customer/legal fields are present on all relevant documents.
- Document type labels and numbering are unambiguous.
- Templates do not depend on hidden frontend-only derived values.

