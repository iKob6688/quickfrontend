# Production Ready Checklist

## Required Before Release
- Frontend build passes
- Frontend lint passes or known baseline is documented
- q01 backend routes are verified
- Official PDF is verified
- Attachment upload/delete/download are verified
- Draft restore/clear are verified
- Discount percentage matches backend behavior
- VAT and withholding calculations match q01
- Multi-company access is verified
- Stale edit conflict behavior is verified

## Current Status
- Frontend source changes are in place.
- The sandbox could not complete a full dependency restore from the network.
- Live q01 validation still needs to be executed.

## Deployment Notes
- Deploy backend attachment route support together with the frontend.
- Do not mark production-ready until q01 verification is complete.
