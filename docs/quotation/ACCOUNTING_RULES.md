# Accounting Rules

## Discount
- q01 backend uses `sale.order.line.discount` as a percentage value.
- Canonical UI label: `ส่วนลด (%)`.
- Calculation:
  - `gross = quantity * unitPrice`
  - `discountAmount = gross * discountPercent / 100`
  - `untaxedAmount = gross - discountAmount`

## VAT
- If VAT is disabled, `taxAmount = 0`.
- If tax metadata exists, taxes are applied from the configured tax list.
- If no tax metadata is available, the VAT rate fallback is used.
- Section and note rows are excluded from totals.

## Withholding Tax
- Frontend estimates withholding from the untaxed document amount.
- Formula:
  - `withholdingAmount = untaxedAmount * withholdingRate / 100`

## Totals
- `grossSubtotal`
- `discountAmount`
- `untaxedAmount`
- `taxAmount`
- `totalIncludingTax`
- `withholdingAmount`
- `amountDue`

## Notes
- This repository currently includes a frontend-side approximation of the accounting rules.
- q01 backend totals remain the source of truth because there is no dedicated quotation compute endpoint in the live controller yet.
