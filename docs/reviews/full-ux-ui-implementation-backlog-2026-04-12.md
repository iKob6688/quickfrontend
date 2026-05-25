# ERPTH UX/UI Implementation Backlog

Date: 2026-04-12  
Source: `docs/reviews/full-ux-ui-function-preserving-review-2026-04-12.md`

## Rules for Every Backlog Item

- Keep current business logic unchanged.
- Keep current route/API contract unchanged.
- Preserve existing working feature behavior.
- Limit changes to UI/copy/layout/workflow clarity only.
- Each item must be regression-tested against the feature it touches.

---

## P1 Critical Workflow Clarity

### Core Shell and Global Pages

- `Login`
  - Simplify Thai-first helper text and reduce technical wording.
  - Clarify the primary value of logging in for daily admin work.
  - Preserve current login, error, redirect, and password-toggle flow.
- `App shell / top nav / mobile nav`
  - Reorder navigation for standard admin flow: daily work first, admin/tools later.
  - Convert mixed English labels to Thai-first labels.
  - Improve scope/permission wording without changing scope behavior.
  - Preserve all existing routes and navigation targets.
- `Global feedback system`
  - Replace mixed English/technical user messages with Thai business language on high-traffic pages first.
  - Standardize loading, empty, retry, error, success, and confirmation wording.
  - Preserve existing mutation/error wiring.

### Dashboard

- `Dashboard`
  - Separate visual priority between "งานวันนี้" and "ภาพรวมผู้บริหาร".
  - Prioritize pending approvals, pending review work, overdue items, and operational shortcuts.
  - Keep all current dashboard widgets working.
  - Preserve current queries and quick actions.

### Sales Workflow

- `Sales order detail`
  - Reframe actions by lifecycle step: confirm, invoice, deliver, send/print.
  - Translate mixed English CTA labels.
  - Preserve current confirm/invoice/email/print/delivery actions.
- `Invoice detail`
  - Group actions by lifecycle step: post, payment, receipt/print, e-Tax, note/amendment.
  - Convert mixed e-Tax and print wording to Thai.
  - Preserve all existing actions and modal flows.
- `Invoices list`
  - Clarify difference between invoice mode and receipt mode.
  - Make payment/document status easier to scan.
  - Preserve all current filters, due logic, and actions.

### Purchase Workflow

- `Purchase request detail`
  - Convert raw/English state output to Thai business wording.
  - Clarify PO creation as the next step after approval.
  - Preserve submit/cancel/create-PO behavior.
- `Purchase order detail`
  - Re-group actions into confirm, receive, vendor bill, cancel.
  - Replace browser-native confirmation for vendor bill open with app confirmation while preserving behavior.
  - Preserve confirm/cancel/receive/create-bill logic.

### Document Review

- `Document Review Inbox`
  - Translate all review states, filters, and toasts into Thai.
  - Improve hierarchy between document facts, issues, AI suggestions, and draft actions.
  - Preserve approval, save review, retry parse, unsupported, draft creation, and copilot actions.

---

## P2 Important Usability

### Core Shell and Global Pages

- `Backend connection`
  - Reframe page as admin/setup tooling in copy and breadcrumb language.
  - Preserve company creation and auto-login.
- `Avatar assistant`
  - Reduce visual competition with main document actions.
  - Preserve current assistant mounting and page-context behavior.
- `Page headers / breadcrumbs / action order`
  - Standardize Thai breadcrumb vocabulary.
  - Normalize primary/secondary CTA ordering.

### Sales Workflow

- `Sales orders list`
  - Clarify quotation vs sale order terminology.
  - Improve filter explanation for job category.
  - Preserve search, tabs, create actions, and open-detail behavior.
- `Sales order form`
  - Improve section grouping and mobile action placement.
  - Standardize Thai validation and line-management wording.
  - Preserve payload shape and form logic.
- `Invoice form`
  - Translate autosave and draft-restore wording to Thai.
  - Improve section hierarchy and mobile completion.
  - Replace line-delete browser confirm with app-styled confirm if behavior remains identical.
  - Preserve customer/product selectors, draft restore, notes reuse, and submit behavior.
- `Register payment modal`
  - Improve Thai labels and partial-payment comprehension.
  - Preserve create/edit payment behavior.
- `PromptPay QR modal`
  - Clarify that QR display is not the same as payment confirmation.
  - Preserve QR behavior.
- `Sales notes list/detail`
  - Clarify where notes should be created from.
  - Preserve note creation and navigation.

### Purchase and Expense Workflow

- `Purchase requests list`
  - Improve next-step visibility by state.
  - Preserve filtering and navigation.
- `Purchase request form`
  - Clarify that PR is upstream of PO.
  - Preserve form logic.
- `Purchase orders list`
  - Surface receiving/vendor bill readiness more clearly.
  - Preserve filters and navigation.
- `Purchase order form`
  - Clarify PR-origin versus manual PO creation.
  - Preserve current source-state handoff and payload.
- `Purchase receipt detail`
  - Clarify what is received and what remains.
  - Preserve route and linked data.
- `Purchase vendor bill detail`
  - Clarify payable context from PO/receipt.
  - Preserve route and linked data.
- `Expenses list`
  - Split user-facing error from technical diagnostics.
  - Clarify next-step meaning by expense status.
  - Preserve list loading, API check, tabs, and search.
- `Expense form`
  - Improve field grouping and Thai wording.
  - Preserve form logic.
- `Expense detail`
  - Add passive next-step guidance by status.
  - Preserve current display and data loading.

### Master Data

- `Customers list`
  - Make bulk selection scope clearer.
  - Convert partner/technical wording to Thai business language.
  - Preserve all filters, bulk actions, and quick-create routes.
- `Customer detail`
  - Group quick-create actions more clearly.
  - Use neutral partner wording instead of revenue-only framing.
  - Preserve quick-create and archive behavior.
- `Customer form`
  - Improve Thai address and field ordering.
  - Preserve create/edit logic.
- `Products list`
  - Improve scanability and selection clarity.
  - Preserve search, selection, and edit action.
- `Product form`
  - Separate basic and advanced/admin sections more clearly.
  - Reduce backend jargon in subtitle/help text.
  - Preserve create/update behavior and tax defaults.

### Accounting and Tax

- `Accounting reports hub`
  - Visually separate reports from admin/setup cards without changing routes.
  - Preserve all existing entries.
- `Profit & Loss`
  - Improve summary-first presentation and Thai errors.
  - Preserve filters and drilldowns.
- `Balance Sheet`
  - Improve reading guidance and Thai error handling.
  - Preserve drilldowns.
- `General Ledger`
  - Remove dev/phase wording from subtitle.
  - Preserve report behavior.
- `Trial Balance`
  - Improve readability and explanatory copy.
  - Preserve report behavior.
- `Partner ledger and drilldown`
  - Clarify customer/vendor orientation.
  - Preserve drilldowns.
- `Aged receivables/payables`
  - Highlight overdue risk visually.
  - Preserve navigation to partner ledger.
- `Cash book / bank book`
  - Improve operational framing.
  - Preserve report behavior.
- `VAT / WHT reports`
  - Improve filing-readiness framing and Thai tax wording.
  - Preserve all current reporting logic.
- `Move line detail`
  - Improve readability only.
  - Preserve data and route behavior.
- `Accounting admin`
  - Add clearer admin-safe grouping and impact wording.
  - Preserve create/update flows.
- `VAT settings admin`
  - Improve warning hierarchy and Thai wording.
  - Preserve create/update/deactivate flows.

### Agent and Specialist AI Pages

- `Agent dashboard`
  - Convert all labels to Thai-first wording.
  - Reposition visually under tools/admin over time.
  - Preserve all routes.
- `Agent OCR / expense / quotation / contact / invoice`
  - Translate labels, helper text, and messages into Thai.
  - Preserve current AI-assisted creation flows.

---

## P3 Polish and Consistency

### Reports Studio and Specialist Tooling

- `Reports Studio dashboard`
  - Translate visible labels to Thai-first specialist wording.
  - Preserve template-opening flow.
- `Template library`
  - Translate labels and helper text.
  - Preserve default/custom separation and refresh behavior.
- `Editor`
  - Translate save/copy/default messages and labels.
  - Preserve all editing behavior.
- `Preview / print`
  - Translate labels such as preview, guides, loading, template not found.
  - Preserve DTO loading and print flow.
- `Branding`
  - Translate load/save/status strings.
  - Preserve branding fetch/update behavior.
- `Reports Studio settings`
  - Translate labels and save-state wording.
  - Preserve autosave/reset behavior.

### Global Consistency Cleanup

- Replace `Unknown error` with a Thai fallback on all reviewed pages.
- Standardize Thai breadcrumbs across modules.
- Standardize empty/loading wording across list pages and report pages.
- Standardize action naming for:
  - save
  - cancel
  - retry
  - create
  - submit for approval
  - receive payment
  - print/PDF
  - send e-Tax/email

---

## Suggested Delivery Sequence

1. Core shell, login, and high-traffic global copy
2. Dashboard
3. Sales module
4. Purchase and expense module
5. Customers and products
6. Accounting reports and tax admin
7. Document Review and Agent tools
8. Reports Studio and specialist admin tools

## Required Regression Suite Per Delivery Batch

- login/logout
- touched page routes
- touched page create/edit/detail actions
- any touched toast/alert/modal flows
- any touched print/e-Tax/review/payment flow
