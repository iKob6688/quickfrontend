# Rollback Plan

## Rollback Triggers
- Build artifact fails validation after deploy
- q01 shows tracebacks or broken quotation save flow
- Attachment upload/delete fails unexpectedly
- Official PDF rendering is broken

## Rollback Steps
1. Revert the frontend deployment to the previous release.
2. Restore the previous backend module revision if the backend route changed.
3. Restart services in the same order used during deploy.
4. Restore the database and filestore only when necessary.

## Limitations
- Attachment uploads created after the backup will be lost if a full restore is used.
- Module rollback on Odoo may require a second controlled restart.
