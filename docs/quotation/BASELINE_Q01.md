# Baseline Q01

## Repository Baseline
- Frontend branch: `fix/quotation-production-q01`
- Frontend HEAD: `5811cc531bc119509bf0da9a00dc14cf89cbb48c`
- Database: `q01`
- Target company: production company configured in q01
- Test user: q01 sales user / production operator

## Current Modules Involved
- Sales quotation frontend
- Sales order detail / list / print preview
- Sales order service layer
- Draft and attachment helpers
- Odoo sales API companion module (`adt_th_api/controllers/api_sales_orders.py`)
- Odoo official report module (`adt_shade_reports`)

## Baseline Findings
- Frontend source is present and quotation screens are implemented.
- The live q01 controller already provides create/update/list/confirm/cancel/deliver/create-invoice/PDF/attachment routes under `/api/th/v1/sales/orders`.
- The controller persists standard `sale.order` fields and line data, but not the richer customer snapshot fields as first-class model fields.
- Build tooling is only partially available in this sandbox.
- `npm install` could not be completed normally because the environment lacks registry access.
- `pnpm install --offline` could not fully resolve every package from the local store.
- q01 backend routes and PDFs must still be verified in the live Odoo environment.

## API Routes Observed in Frontend
- `POST /th/v1/sales/orders`
- `PUT /th/v1/sales/orders/:id`
- `POST /th/v1/sales/orders/:id/confirm`
- `POST /th/v1/sales/orders/:id/deliver`
- `POST /th/v1/sales/orders/:id/attachments/upload`
- `DELETE /th/v1/sales/orders/:id/attachments/:attachment_id`
- `GET /th/v1/sales/orders/:id/pdf`

## Known Baseline Gaps
- Full q01 runtime evidence is not captured in this sandbox.
- Official Odoo PDF and attachment endpoints require live q01 verification.
- Backend fallback behavior still depends on the deployed Odoo module set.
