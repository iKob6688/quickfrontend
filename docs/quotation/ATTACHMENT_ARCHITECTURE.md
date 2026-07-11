# Attachment Architecture

## Current Design
- `File` objects live only in local UI state.
- Draft storage keeps metadata only.
- JSON payloads must not contain raw `File` objects.
- Uploaded attachments are stored through backend `ir.attachment` records.

## Frontend Flow
1. User picks files in the quotation form.
2. The form stores local file state for preview and upload.
3. Save request stores only metadata in the quotation payload.
4. After the quotation is saved, queued files are uploaded.
5. Successful uploads replace local-only entries with backend metadata.

## Backend Flow
- Attachments are linked to `sale.order`.
- Upload and delete operations must enforce permissions.
- Attachment records should return `id`, `name`, `url`, `size`, and `type`.

## Safety Notes
- Draft persistence must not serialize `File`.
- Upload failure should not be reported as a full success.
- Failed files must remain available for retry when possible.

## Current Limitation
- The sandbox cannot fully validate the q01 upload/delete path end-to-end.
