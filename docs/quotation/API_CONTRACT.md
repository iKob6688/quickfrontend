# Quotation API Contract

## Purpose
This document records the verified frontend-to-backend contract for the quotation workflow on q01.
It distinguishes live q01 behavior from fields that are only preserved by the frontend as metadata.

## Core Fields

| Feature | Frontend request field | Backend route | Backend request field | Odoo model field | Backend response field | Frontend mapper field | Required | Fallback behavior | Verified in q01 |
|---|---|---|---|---|---|---|---|---|---|
| Order create | `orderDate`, `currency`, `lines`, `partnerId` when available | `POST /api/th/v1/sales/orders` | RPC payload | `sale.order` | order payload | `mapBackendOrderToDetail` | yes | legacy payload retry on 400/422 | verified |
| Order update | `id`, `orderDate`, `currency`, `lines`, `partnerId` when available | `PUT /api/th/v1/sales/orders/:id` | RPC payload | `sale.order` | order payload | `mapBackendOrderToDetail` | yes | legacy payload retry on 400/422 | verified |
| Customer free text | `customerNameText`, `customerAddressText`, `customerPhoneText`, `customerEmailText`, `customerTaxIdText`, `customerBranchText` | same create/update routes | current q01 controller ignores these fields | not persisted by live controller | same aliases from response mappers if present | same aliases | optional | preserved in notes wrapper only for legacy fallback | verified as frontend-only metadata |
| Internal notes | `internalNotes` | same create/update routes | current q01 controller ignores this field | not persisted by live controller | same aliases if backend adds them later | same aliases | optional | preserved in notes wrapper only for legacy fallback | verified as frontend-only metadata |
| Payment term | `paymentTermText` | same create/update routes | current q01 controller ignores this field | not persisted by live controller | same aliases if backend adds them later | same aliases | optional | preserved in notes wrapper only for legacy fallback | verified as frontend-only metadata |
| VAT | `vatEnabled`, `vatRate` | same create/update routes | current q01 controller ignores these fields | not persisted by live controller | same aliases if backend adds them later | same aliases | optional | frontend computes estimate locally | verified as frontend-only metadata |
| WHT | `withholdingTaxEnabled`, `withholdingTaxRate` | same create/update routes | current q01 controller ignores these fields | not persisted by live controller | same aliases if backend adds them later | same aliases | optional | frontend computes estimate locally | verified as frontend-only metadata |
| Lines | `lineType`, `productId`, `description`, `quantity`, `unitPrice`, `discount`, `taxIds` | same create/update routes | `display_type`, `product_id`, `description`, `quantity`, `unit_price`, `discount`, `tax_ids` | `sale.order.line` | line payload | line mapper | yes | section/note lines serialize as zero-value | verified |
| Attachments | local files + attachment metadata | `POST /api/th/v1/sales/orders/:id/attachments/upload` | multipart `ufile` | `ir.attachment` | attachment metadata with `id`, `name`, `url`, `mimetype`, `size`, `type` | `attachments` | optional | metadata-only draft until upload succeeds | verified |
| Attachment delete | saved attachment id | `DELETE /api/th/v1/sales/orders/:id/attachments/:attachment_id` | path id | `ir.attachment` | delete result | `attachments` | optional | keep local file if delete fails | verified |
| PDF download | `id` | `GET /api/th/v1/sales/orders/:id/pdf` | path id | official report | PDF blob | download handler | optional | fallback to HTML preview if unavailable | verified |

## Response Notes
- Frontend mappers accept camelCase and snake_case aliases where possible.
- Attachment metadata is expected to include `id`, `name`, `url`, `size`, and `type`.
- Section lines should be represented as `line_section`.
- Note lines should be represented as `line_note`.

## Open Verification Items
- Live q01 still needs end-to-end execution evidence in this sandbox.
- The backend controller does not currently persist the extra quotation snapshot fields above.
- Official PDF template source should still be checked against `adt_shade_reports` in the live Odoo runtime.
