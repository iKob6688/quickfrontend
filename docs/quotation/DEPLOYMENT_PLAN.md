# Deployment Plan

## Pre-deploy
- Confirm the target database is `q01`.
- Back up the database and filestore.
- Record the frontend and backend commit hashes.
- Verify upload size limits on the proxy and Odoo worker configuration.
- Confirm environment variables for q01.

## Deploy
- Deploy the frontend build artifact.
- Upgrade the required Odoo modules on q01.
- Restart the minimum required services.
- Verify attachment upload and PDF routes.

## Post-deploy
- Create a quotation with free-text customer data.
- Save a quotation with discount, VAT, and withholding.
- Upload and delete an attachment.
- Open the official PDF.
- Re-open the quotation and confirm the values persist.

## Rollback
- Revert the frontend release.
- Roll back the backend module commit if needed.
- Restore the database only if data corruption is detected.
- Keep the filestore backup aligned with the DB snapshot.
