# q01: `qacc_partner_change_log` missing table

Date observed: 2026-07-07

## Symptom

Saving an employee/contact that writes back to `res.partner` fails with:

```text
psycopg2.errors.UndefinedTable: relation "qacc_partner_change_log" does not exist
```

The traceback shows the failure path:

- `hr.employee.write()`
- `_inverse_work_contact_details()`
- `res.partner.write()`
- `adt_quick_acc/models/res_partner_quick_acc.py`
- `_qacc_log_partner_change()`
- `qacc.partner.change.log.create()`

## Root Cause

The backend hook exists and is being executed, but the database `q01` does not have the physical table for `qacc.partner.change.log`.

That usually means one of these is true:

- `adt_quick_acc` was not upgraded on `q01`
- the model was added, but the module migration that creates the table was not run
- the database is using code newer than the installed schema

## What this is not

- Not a React rendering issue
- Not an API payload issue
- Not a frontend validation issue

The frontend can trigger the save, but the crash happens inside backend write logic after the API call reaches Odoo.

## Fix path on q01

1. Upgrade/install the backend module that owns `qacc.partner.change.log` on `q01`.
2. Verify the model is registered and the table exists in PostgreSQL.
3. Re-test the same employee/contact save flow.
4. Confirm the write no longer raises `UndefinedTable`.

## Verification

After the backend upgrade:

- saving employee contact fields should succeed
- `res.partner.write()` should complete normally
- the logging hook should insert into `qacc_partner_change_log`
- no SQL traceback should appear in the browser or Odoo logs
