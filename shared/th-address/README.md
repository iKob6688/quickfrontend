# Thailand Address Shared Data

This directory is the git-tracked source for Thailand province, district, and subdistrict master data used by both ERPTH React and Odoo.

## Upstream

- Upstream dataset: `Cerberus/Thailand-Address`
- Current seed source in this workspace: `adt_th_localization/data/thai_address/*`
- Canonical repo path for review: `shared/th-address/raw/*`

## Layout

- `raw/`: upstream-style JSON files kept close to the original schema
- `generated/`: normalized JSON files produced by `scripts/sync-th-address.mjs`

## Canonical Schema

- Province: `id`, `code`, `name_th`, `name_en`, `state_name`, `search_name`, `search_name_no_prefix`
- District: `id`, `province_id`, `code`, `name_th`, `name_en`, `search_name`, `search_name_no_prefix`
- Subdistrict: `id`, `district_id`, `province_id`, `code`, `name_th`, `name_en`, `zip_code`, `search_name`, `search_name_no_prefix`

## Update Workflow

1. Replace files in `raw/` from the approved upstream source.
2. Run `npm run sync:th-address`.
3. Review diffs in:
   - `shared/th-address/generated/`
   - `public/th-address/`
   - `adt_th_localization/data/thai_address/` in the Odoo workspace
4. Confirm counts and a few sample zip codes before shipping.
