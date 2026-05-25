# ERPTH Full UX/UI Function-Preserving Review

Date: 2026-04-12  
Scope: React ERPTH user-facing routes and major supporting interaction flows  
Method: Static review of current route map, page components, UI copy, actions, and workflow continuity  

## Review Intent

This review covers the current ERPTH React system page by page and workflow by workflow without proposing business-logic changes. The purpose is to improve usability, readability, Thai language consistency, action clarity, mobile one-hand use, and workflow continuity while preserving all current working functions.

## Non-Negotiable Preservation Rules

- Existing API contracts must remain unchanged.
- Existing route structure must remain unchanged unless a purely navigational regrouping is done without breaking deep links.
- Existing working flows must remain intact:
  - login/logout
  - invoice create/edit/post/payment/e-Tax
  - sales order create/detail/print/invoice progression
  - purchase request/order/detail flows
  - expense list/detail/form
  - customer/product management
  - accounting report drilldowns
  - document review and draft creation
  - settings/admin forms
  - Reports Studio preview/print/editor flows

## Recommendation Labels

- `UI polish only`
- `workflow clarity only`
- `label/message only`
- `layout/navigation only`
- `guarded enhancement without changing existing function`

## Global Preservation Checklist

Every implementation based on this review must verify:

- route still works
- page still loads from the same API source
- current action buttons still complete the same job
- current states and statuses are not removed
- no hidden regression in create/edit/post/payment/review/report flows

---

## 1. Core Shell and Global System Pages

### Login
Route: `/login`

Purpose  
Help the user enter ERPTH securely and confidently.

Current strengths  
- Clear username/password flow.
- Password show/hide is already available.
- Brand and business context are visible.
- Error rendering already exists.

UX issues  
- Current naming mixes product brands and platform names, which may confuse normal Thai admin users.
- The page explains middleware/security in technical language rather than business language.
- The main reassurance message is more system-oriented than task-oriented.

UI issues  
- Header area is visually nice, but the actual login task could be even more direct.
- The helper copy below the submit button is too technical for first-line accounting/admin users.

Thai text/message issues  
- Main labels are already Thai, but product naming is mixed.
- Supporting text should be simplified to Thai operational language.

Safe improvements  
- `label/message only`: keep login logic exactly the same, rewrite helper text into simple Thai.
- `UI polish only`: shorten the supporting copy to explain what users can do after logging in.
- `workflow clarity only`: add a short line such as "เข้าสู่ระบบเพื่อทำงานเอกสารประจำวัน" instead of middleware detail.

Regression guard  
- login success and redirect still work
- login error still renders
- password toggle still works
- unauthorized redirect still works

### App Shell, Top Nav, Mobile Nav
Primary container: `AppLayout`

Purpose  
Provide stable global navigation for daily work.

Current strengths  
- Main modules are all reachable from one shell.
- Desktop and mobile navigation both exist.
- Approval badge is already surfaced globally.
- Mobile nav hides itself on some large data-entry forms to reduce clutter.

UX issues  
- The nav is too flat for a standard Thai admin user. Daily work, admin setup, tools, AI, and Reports Studio appear at similar priority.
- Permission behavior is confusing: some restricted items appear visually weakened but still navigate and let the backend reject later.
- Reports Studio and backend connection are too visible for everyday users.

UI issues  
- Label density is high for both desktop and mobile.
- Mobile bottom nav has too many equally weighted destinations for one-hand use.
- Mixed Thai and English labels reduce trust and scan speed.

Thai text/message issues  
- Examples still mixed: `Review Inbox`, `Reports Studio`, `VAT and Taxes`.
- Permission tooltip is partly technical.

Safe improvements  
- `layout/navigation only`: regroup visual navigation into daily work, reports, settings, tools while keeping current routes intact.
- `label/message only`: convert all visible nav labels to Thai-first naming.
- `workflow clarity only`: make restricted items either clearly locked or move them under tools/admin.

What stays exactly the same  
- same routes
- same scopes
- same logout behavior
- same assistant mount point

Regression guard  
- desktop nav links still open the same routes
- mobile nav still works one-handed
- approval badge still updates
- scope-protected routes still behave correctly

### Global Headers, Breadcrumbs, and Page Actions

Purpose  
Orient the user and clarify what the page is for and what the next action is.

Current strengths  
- `PageHeader` is reused widely.
- Most pages already define title, subtitle, breadcrumb, and actions.

UX issues  
- Breadcrumb tone is inconsistent across modules.
- Some pages use operational Thai, some use technical English, some mix both.
- On many pages, primary and secondary actions are not consistently ordered by business priority.

UI issues  
- Long action rows may wrap awkwardly on smaller screens.
- Some pages overload the header with too many buttons.

Thai text/message issues  
- Breadcrumbs still contain `Home`, `Reports`, `Agent`, `Settings` in English.

Safe improvements  
- `label/message only`: standardize breadcrumb vocabulary in Thai.
- `UI polish only`: keep action count low in header and push secondary actions into dropdowns where needed.
- `workflow clarity only`: ensure the next business step is always the first button.

Regression guard  
- same header actions remain available
- no action is removed, only regrouped visually

### Global Feedback System

Purpose  
Tell the user what is happening, what succeeded, what failed, and what to do next.

Current strengths  
- Toast pattern is used broadly.
- Loading, error, and empty states exist on most important screens.

UX issues  
- Messaging tone is inconsistent across modules.
- Technical backend wording leaks into user space.
- Some confirmations still use raw browser confirm text.

UI issues  
- Some dangerous/destructive confirmations are browser-native and visually inconsistent.
- Empty/loading states vary in depth and usefulness.

Thai text/message issues  
- Many messages are still mixed Thai/English:
  - `Unknown error`
  - `Submit e-Tax`
  - `Retry parse`
  - `Saved review changes`
  - `Loading branding`
  - `Saving...`
  - `Agent Dashboard`
  - `Template not found`
- Error and success messages should be consistently Thai and business-readable.

Safe improvements  
- `label/message only`: build a Thai message standard for toast/alert/modal/empty/loading.
- `guarded enhancement without changing existing function`: replace `window.confirm` with app-styled confirmation modal only where behavior can remain identical.
- `UI polish only`: standardize empty state pattern and retry wording.

Regression guard  
- success/error hooks still fire
- no mutation callbacks are removed
- destructive actions still require confirmation

### Backend Connection
Route: `/backend-connection`

Purpose  
Provision company/admin access and connect ERPTH to Odoo.

Current strengths  
- Useful for setup and environment provisioning.
- Already isolated as its own page.

UX issues  
- This is not daily-work UX and should not feel like a normal admin task for operational users.

UI issues  
- Page belongs to admin/tools area, not the same cognitive tier as invoices and expenses.

Thai text/message issues  
- Breadcrumb and subtitle still include technical provisioning language.

Safe improvements  
- `layout/navigation only`: keep the route and feature unchanged, but visually move it under admin/tools grouping.
- `label/message only`: simplify wording into Thai admin language.

Regression guard  
- company creation and auto-login path still works

### Avatar Assistant

Purpose  
Provide AI assistance without interrupting daily document processing.

Current strengths  
- Assistant exists globally and can support cross-page context.

UX issues  
- For standard Thai admin users, persistent assistant UI can become background noise unless positioned carefully.
- AI-related naming and behavior must not compete with the main transaction CTA.

Safe improvements  
- `layout/navigation only`: keep placement non-intrusive and secondary.
- `label/message only`: all assistant-facing copy should use Thai business wording.

Regression guard  
- assistant still mounts
- page context integration still works

---

## 2. Dashboard and Management Views

### Dashboard
Route: `/dashboard`

Purpose  
Show a quick business snapshot and help the user jump to pending work.

Current strengths  
- Wide functional coverage.
- KPI, approvals, AI tasks, accounting summary, e-Tax, purchasing, products, and connection info are already present.
- Quick action cards and approval actions already support real work.

UX issues  
- The page currently tries to serve both standard admin and management in one screen.
- Daily work queue and analytical dashboard are blended together.
- Too many cards have similar priority, making scan order weak.
- Users may not immediately know what to act on first.

UI issues  
- Card density is high.
- On mobile, the amount of information can feel heavy.
- Some cards are informational while others are actionable, but they are not visually differentiated enough.

Thai text/message issues  
- There is still mixed wording such as `Quickfront18`, `task`, `approval inbox`.
- Error messages still include `Unknown error`.

Safe improvements  
- `workflow clarity only`: split the page conceptually into "งานวันนี้" and "ภาพรวมผู้บริหาร" while keeping all widgets available.
- `UI polish only`: visually prioritize approvals, overdue items, and pending review work above passive analytics.
- `label/message only`: normalize all dashboard card titles and loading/errors into Thai.

What stays exactly the same  
- same dashboard queries
- same approval actions
- same drilldown links
- same e-Tax and AI blocks

Regression guard  
- all current cards still function
- approval approve/reject still works
- KPI widgets still load
- purchase/product/accounting links still navigate

---

## 3. Sales Workflow Pages

### Sales Orders List
Route: `/sales/orders`

Purpose  
Let users scan, filter, and open quotations and sale orders.

Current strengths  
- Supports quotation and sale order in one list.
- Status tabs, search, and job category filter already exist.
- Quick creation CTAs are available.

UX issues  
- Combining quotation and sale order is practical, but the distinction is still mentally expensive.
- Job category filtering is domain-specific and may need clearer business explanation.
- The user journey from quotation to confirmed sale to invoice is not obvious from the list alone.

UI issues  
- Header action row is busy.
- `Sale Order` label remains English.

Thai text/message issues  
- Subtitle, type badge, and errors still mix English.
- Backend troubleshooting text is too technical for a normal user-facing error.

Safe improvements  
- `label/message only`: convert `Sale Order` to Thai-first wording with optional English helper.
- `workflow clarity only`: add visible row-level cues for next step such as "พร้อมยืนยัน", "พร้อมสร้างใบแจ้งหนี้".
- `UI polish only`: simplify header actions and keep product shortcuts secondary.

Regression guard  
- tabs still filter correctly
- job filter still works
- create quotation/create sale order still work
- open detail still works

### Sales Order Form
Routes: `/sales/orders/new`, `/sales/orders/:id/edit`

Purpose  
Create or edit quotation/sale order records.

Current strengths  
- Core create/edit flow exists.
- Product-oriented entry is already supported.
- This is a key functional page and should be preserved.

UX issues  
- Form completion confidence needs to be higher for normal admins.
- The user needs clearer structure between header info, partner info, line items, totals, and downstream actions.

UI issues  
- Need stronger one-hand mobile completion and clearer section grouping.

Thai text/message issues  
- Validate all labels, helper text, warnings, and delete-line confirmation in Thai.

Safe improvements  
- `UI polish only`: stronger section grouping and sticky primary action on mobile.
- `workflow clarity only`: show what the document becomes after saving.
- `label/message only`: standardize validation and line-item deletion text.

Regression guard  
- create/edit still submit the same payload
- line add/edit/remove still works
- pricing/tax calculation still displays correctly

### Sales Order Detail
Route: `/sales/orders/:id`

Purpose  
Help the user understand current order state and perform the next step.

Current strengths  
- Real next-step actions already exist:
  - confirm quotation
  - create invoice
  - send email
  - print
  - deliver
- Status-based action visibility is already present.

UX issues  
- CTA labels like `Confirm -> Sale Order` and `Confirm -> Invoice` are functional but not natural Thai business language.
- The page is strong functionally, but the lifecycle story can be clearer.
- Printing, emailing, delivery, and invoicing are all available, but the primary next action should stand out more.

UI issues  
- Action row is crowded.
- Delivery/invoice/print/email should be grouped by workflow, not by raw availability.

Thai text/message issues  
- Several labels remain English:
  - `Send -> Email`
  - `Default company paper format`
  - `Reports Studio templates`
  - `Default`

Safe improvements  
- `workflow clarity only`: add a visible document-progress strip.
- `label/message only`: rewrite all CTA labels into Thai business terms.
- `UI polish only`: separate "ขั้นตอนถัดไป" from "พิมพ์/ส่งออก".

Regression guard  
- confirm still works
- create invoice still works
- send email fallback still works
- print preview still works
- delivery still works

### Sales Delivery Detail
Route: `/sales/deliveries/:id`

Purpose  
Show fulfillment or delivery status for a sales order.

Current strengths  
- Route exists and supports workflow continuity.

UX issues  
- Delivery is a critical business milestone but is less visible than quotation and invoice steps.
- The fulfillment context must be explicit: what was delivered, what remains, what this affects next.

Safe improvements  
- `workflow clarity only`: make delivery status language explicit and connect it back to order/invoice context.
- `label/message only`: Thai-first status language.

Regression guard  
- route still opens
- linked sales-order context remains intact

### Invoices List
Routes: `/sales/invoices`, `/sales/receipts`

Purpose  
Let users manage invoice and receipt-related scanning, payment status, and next actions.

Current strengths  
- Strong practical design already exists:
  - status tabs
  - due filter logic
  - payment state derivation
  - receipt mode
  - action buttons
  - e-Tax action trigger
- The page is already one of the most mature operational screens.

UX issues  
- Receipt mode is useful but should feel more obviously like a focused sub-workflow.
- Action logic is correct but not always self-explanatory for new users.
- Payment state and document state can still be mentally separate for normal admins.

UI issues  
- Many status columns are informative, but the most important action could stand out more.
- Receipt mode and invoice mode should feel more clearly distinct visually.

Thai text/message issues  
- `Submit e-Tax` remains mixed language.
- Some status semantics should be more explicit in Thai.

Safe improvements  
- `workflow clarity only`: emphasize next business step by state.
- `label/message only`: rename e-Tax actions and receipt-mode headings in Thai.
- `UI polish only`: stronger visual distinction between document state and payment state.

Regression guard  
- list filters still work
- due logic still works
- receipt mode still opens correct action target
- e-Tax submit still works

### Invoice Form
Routes: `/sales/invoices/new`, `/sales/invoices/:id/edit`

Purpose  
Create and edit invoices with customer, lines, due dates, and notes.

Current strengths  
- Customer search exists.
- Product combobox exists.
- Draft autosave/restore exists.
- Recent notes reuse exists.
- Error extraction and field errors are already wired.

UX issues  
- This page is functionally rich and should be protected carefully.
- Draft restore is useful, but it should feel more reassuring and less system-oriented.
- The form can still be made easier for one-hand completion on mobile.
- The user should better understand what is required before submission.

UI issues  
- The page needs stronger section hierarchy for header, customer, lines, and notes.
- The autosave indicator is helpful but understated.

Thai text/message issues  
- `autosaved` is still English.
- Some helper text still sounds technical.
- Delete-line confirmation uses raw browser confirm wording.

Safe improvements  
- `UI polish only`: improve section layout and sticky action treatment on mobile.
- `label/message only`: convert autosave/draft restore wording fully to Thai.
- `guarded enhancement without changing existing function`: replace line-delete browser confirm with app modal preserving the same confirm behavior.

Regression guard  
- create/edit payload remains unchanged
- customer pick still works
- product pick still works
- draft save/restore still works
- recent notes still work
- submit and server-side field errors still work

### Invoice Detail
Route: `/sales/invoices/:id`

Purpose  
Central document page for posting, payment, printing, receipt, e-Tax, amendment, and note generation.

Current strengths  
- This is one of the most functionally complete pages in the system.
- Supports:
  - post invoice
  - register payment
  - edit payment
  - print/PDF
  - Reports Studio print flows
  - PromptPay QR
  - e-Tax submit/poll/email
  - amend invoice
  - credit/debit note creation
- Strong example of function continuity.

UX issues  
- The page has many available actions; for a standard Thai admin, action overload is the main risk.
- The current order of actions can be simplified into workflow groups:
  - posting
  - payment
  - receipt/print
  - e-Tax
  - adjustment notes
- Some actions should be visually framed as "only after previous step" rather than simply present/disabled.

UI issues  
- High action density in the header and modals.
- The print/PDF decision tree is useful but could be easier to scan.
- e-Tax and receipt actions should read as a continuation of payment, not as a separate concept.

Thai text/message issues  
- Mixed terms remain:
  - `Submit e-Tax`
  - `Poll e-Tax`
  - `ETax document`
  - `Reports Studio`
- Some empty/error states still show `Unknown error`.

Safe improvements  
- `workflow clarity only`: group all actions by current lifecycle step.
- `label/message only`: fully Thai user-facing action and feedback text.
- `UI polish only`: surface one primary action based on current invoice state.

What stays exactly the same  
- same invoice loading
- same post mutation
- same payment mutations
- same e-Tax mutations
- same note creation flows
- same Reports Studio integration

Regression guard  
- post invoice still works
- register payment/edit payment still work
- print and PDF still work
- PromptPay modal still works
- e-Tax submit/poll/email still work
- amend/credit/debit note creation still works

### Register Payment Modal

Purpose  
Capture payment data safely and clearly.

Current strengths  
- Modal exists and supports payment entry and edit scenarios.

UX issues  
- Payment concepts can be intimidating; users need straightforward Thai labels and stronger confidence cues for partial/full payment.

UI issues  
- Confirmation and field explanation should reduce fear of posting wrong payment data.

Safe improvements  
- `label/message only`: improve Thai labels for method, amount, reference, and partial payment explanation.
- `UI polish only`: emphasize total due, amount entered, and resulting balance.

Regression guard  
- register payment mutation unchanged
- edit payment mutation unchanged

### PromptPay QR Modal

Purpose  
Support Thai-friendly payment collection.

Current strengths  
- Valuable localized feature.

UX issues  
- Users need explicit explanation of when to use it and what it means for payment completion.

Safe improvements  
- `label/message only`: clarify that QR display does not itself confirm payment unless payment is recorded.
- `UI polish only`: clearer instruction block and close action.

Regression guard  
- QR behavior remains unchanged

### Sales Notes and Debit/Credit Note Flow
Routes: `/notes`, `/sales/notes/:id`

Purpose  
Manage credit/debit note workflows linked to invoice lifecycle.

Current strengths  
- Notes are reachable and integrated from invoice detail.
- Shared note list supports both sales and purchase domains.

UX issues  
- The mixed sales/purchase menu can reduce discoverability.
- Users may not immediately understand where to create a note from if they start at the list.

UI issues  
- The page explains the flow only partially.

Thai text/message issues  
- Notes terminology should be fully consistent across list, modal, and detail pages.

Safe improvements  
- `workflow clarity only`: explain clearly that notes are typically created from the source document detail page.
- `label/message only`: make sales note vs purchase note wording explicit in Thai.

Regression guard  
- note creation from detail pages still works
- note list filters still work

---

## 4. Purchase and Expense Workflow Pages

### Purchase Requests List
Route: `/purchases/requests`

Purpose  
Scan and manage PRs from draft through approval to PO creation.

Current strengths  
- Solid list page with tabs, search, and clear counts.
- Header shortcuts support creation flow.

UX issues  
- State progression is present, but conversion to PO can be made more visible.

UI issues  
- Similar to invoice and sales lists, but should highlight approval-readiness and PO follow-up more strongly.

Thai text/message issues  
- Mostly Thai already; ensure all error/empty states avoid English fallbacks.

Safe improvements  
- `workflow clarity only`: show more explicit “ขั้นตอนถัดไป” cue by state.
- `UI polish only`: make approved items more clearly actionable toward PO.

Regression guard  
- list filtering still works
- create PR still works
- open detail still works

### Purchase Request Form
Routes: `/purchases/requests/new`, `/purchases/requests/:id/edit`

Purpose  
Capture purchase demand clearly enough for approval and conversion.

Current strengths  
- Core create/edit flow exists.

UX issues  
- Form should clearly communicate that it is an upstream document, not the final PO.

Safe improvements  
- `workflow clarity only`: clarify what happens after save and after submit for approval.
- `label/message only`: standardize field labels in Thai.

Regression guard  
- form submit/edit behavior unchanged

### Purchase Request Detail
Route: `/purchases/requests/:id`

Purpose  
Show PR status and support submit, cancel, and PO creation.

Current strengths  
- Lifecycle badges already exist.
- Next-step actions are present and state-aware.
- PO creation handoff exists.

UX issues  
- The action `Create PO` should read more naturally for Thai admins.
- Status badge currently shows raw state code on some surfaces.

UI issues  
- Good process strip exists, but labels should be more business-readable.

Thai text/message issues  
- `invalid id`, `Create PO`, and raw state values should be Thai.

Safe improvements  
- `label/message only`: translate all residual English/raw state outputs.
- `workflow clarity only`: keep the process strip but refine labels for standard admins.

Regression guard  
- submit for approval still works
- cancel still works
- open/create PO still works

### Purchase Orders List
Route: `/purchases/orders`

Purpose  
Manage supplier-facing purchase orders and scan fulfillment/payment readiness.

Current strengths  
- Good core list structure.
- Search, tabs, and entry into detail are already working.

UX issues  
- Purchase order states are visible, but receiving and vendor bill readiness are not surfaced strongly enough from the list.

UI issues  
- "Print report" disabled button adds noise unless a clear "coming soon" rationale is shown.

Thai text/message issues  
- `Unknown error` fallback remains.

Safe improvements  
- `workflow clarity only`: surface receiving and billing readiness cues.
- `label/message only`: keep all list messaging in Thai.

Regression guard  
- list filters still work
- open detail still works
- create PO still works

### Purchase Order Form
Routes: `/purchases/orders/new`, `/purchases/orders/:id/edit`

Purpose  
Create and edit purchase orders, including PR-origin scenarios.

Current strengths  
- Essential document form exists.

UX issues  
- Users need stronger cues when the order is being created from a purchase request versus manually.

Safe improvements  
- `workflow clarity only`: better explain source PR context and what the next step is after save.
- `UI polish only`: clearer grouping of supplier, dates, lines, and taxes.

Regression guard  
- source PR handoff still works
- form submit payload unchanged

### Purchase Order Detail
Route: `/purchases/orders/:id`

Purpose  
Drive PO confirmation, receiving, cancellation, and vendor bill creation.

Current strengths  
- State-based actions are already well integrated.
- Receiving and vendor bill creation exist, which is important.
- This page already protects function well.

UX issues  
- This is a critical procure-to-pay page, but action order should highlight the single next step more strongly.
- Vendor bill creation currently relies on user understanding of receiving completeness.
- Browser confirm for opening vendor bill is inconsistent with the rest of the app.

UI issues  
- Good data table and status mapping.
- Could benefit from a clearer process strip like PR detail.

Thai text/message issues  
- Confirmation prompt for opening vendor bill is browser-native and verbose.
- Ensure all vendor-bill creation language is Thai-first.

Safe improvements  
- `workflow clarity only`: group actions into confirm, receive, bill, cancel.
- `guarded enhancement without changing existing function`: replace browser confirm with app modal preserving the exact same choice.
- `label/message only`: simplify receiving and vendor bill guidance.

Regression guard  
- confirm PO still works
- cancel PO still works
- receive goods still works
- create vendor bill still works

### Purchase Receipt Detail
Route: `/purchases/receipts/:id`

Purpose  
Show receiving details and progress from PO to stock receipt.

Current strengths  
- Route exists and supports downstream tracking.

UX issues  
- Receiving should clearly explain what has been received, what remains, and what comes next.

Safe improvements  
- `workflow clarity only`: add receiving summary and next-step context back to PO/vendor bill.

Regression guard  
- route still opens
- linked receipt context remains intact

### Purchase Vendor Bill Detail
Route: `/purchases/bills/:id`

Purpose  
Let users inspect payable-side document details after PO/receipt.

Current strengths  
- Route exists and keeps procure-to-pay continuity.

UX issues  
- Should better explain relation between PO, received quantity, and payable amount.

Safe improvements  
- `workflow clarity only`: make payable context and next step clearer.
- `label/message only`: use Thai-first payable terminology.

Regression guard  
- route still opens
- vendor bill context remains intact

### Purchase Note Detail/List

Purpose  
Handle debit/credit note logic on the purchase side consistently with sales.

Current strengths  
- Shared note infrastructure exists.

Safe improvements  
- `keep current function, improve only wording/layout consistency`

Regression guard  
- purchase note viewing still works

### Expenses List
Route: `/expenses`

Purpose  
Provide a daily admin list of expense claims/records with status progression.

Current strengths  
- Clean list structure with tabs and search.
- Status terminology is already mostly Thai.
- Practical operational design.

UX issues  
- For normal admin users, linking expense status to next required action could be clearer.
- API-unavailable state is technically helpful but too server-oriented for most front-line users.

UI issues  
- The troubleshooting block is useful for developers/admins but should not dominate the normal UX.

Thai text/message issues  
- Technical server instructions should be separated from end-user messaging.
- `Unknown error` remains in fallback paths.

Safe improvements  
- `workflow clarity only`: show next-step by state.
- `label/message only`: split user message from technical diagnostic message.
- `layout/navigation only`: keep diagnostics collapsible or secondary.

Regression guard  
- list still loads
- api check still works
- search/tabs still work

### Expense Form
Routes: `/expenses/new`, `/expenses/:id/edit` if present in flow

Purpose  
Create/edit expense records.

Current strengths  
- Flow exists in route map.

UX issues  
- Needs strong clarity around employee/vendor/tax/attachment meaning for non-accountant admins.

Safe improvements  
- `UI polish only`: clearer grouping and mobile completion.
- `label/message only`: Thai-first form language and validation.

Regression guard  
- form submit/edit unchanged

### Expense Detail
Route: `/expenses/:id`

Purpose  
Review expense detail, totals, notes, and line items.

Current strengths  
- Clean summary card structure.
- Good amount visibility.
- Stable detail page without unnecessary action overload.

UX issues  
- Status is visible, but next step is not visible when the record is still in-progress.

UI issues  
- Good layout overall; can be improved with clearer process context only.

Thai text/message issues  
- `Unknown error` fallback remains.

Safe improvements  
- `keep current function, improve only wording/layout consistency`
- `workflow clarity only`: add passive next-step guidance by state.

Regression guard  
- detail loading unchanged
- totals and lines unchanged

---

## 5. Master Data Pages

### Customers List
Route: `/customers`

Purpose  
Search, filter, bulk select, and manage partners.

Current strengths  
- Strong page for operations:
  - active/archived/all tabs
  - company/person filtering
  - bulk selection
  - query-based bulk activate/deactivate
  - assistant page context
- Quick jump actions to create sales/purchase documents are valuable.

UX issues  
- This page is powerful, but may feel like a power-user tool because of selection complexity.
- Bulk-select-all-matching behavior needs very explicit wording and safety cues.
- Since this page supports both customers and vendors under partner data, users need clearer role framing.

UI issues  
- Header action row is quite busy.
- Bulk selection state should remain visible when active.

Thai text/message issues  
- Page title still includes `/ Contacts` and `res.partner`.
- API error blocks still show `Error:` and `Unknown error`.

Safe improvements  
- `workflow clarity only`: separate normal admin actions from bulk maintenance actions.
- `label/message only`: convert technical partner language into Thai business language.
- `UI polish only`: make selection scope and impact more obvious.

Regression guard  
- filters still work
- activate/archive still work
- bulk-by-query behavior unchanged
- quick-create actions still work

### Customer Detail
Route: `/customers/:id`

Purpose  
Show contact profile and provide fast entry into related transactions.

Current strengths  
- Excellent quick-create shortcuts from the partner page.
- Copy actions for tax ID, email, phone, and mobile are useful.
- Archive/unarchive is integrated.

UX issues  
- This page is already strong. Main opportunity is making the page feel less like a raw contact record and more like a business relationship profile.

UI issues  
- Action row can be crowded on smaller screens.
- Related transaction history is not visible here, which limits context.

Thai text/message issues  
- Some route context still says "รายรับ" although the partner can be both customer and vendor.

Safe improvements  
- `keep current function, improve only wording/layout consistency`
- `workflow clarity only`: rename page context to neutral partner/contact language.
- `UI polish only`: group quick-create actions under "สร้างเอกสาร".

Regression guard  
- archive/unarchive still works
- quick-create links still work
- copy actions still work

### Customer Form
Routes: `/customers/new`, `/customers/:id/edit`

Purpose  
Create and edit contact records for sales and purchase workflows.

Current strengths  
- Core form exists.
- Thai address selectors are already in the system.

UX issues  
- This page is central for Thai data quality and must be very easy for normal admins.
- Address flow should feel local, not generic.

UI issues  
- Needs strong field grouping: identity, tax info, contact info, address, pricing/tax defaults.

Thai text/message issues  
- API error conversion should always end in user-readable Thai.
- Loading and save states should be Thai-first throughout.

Safe improvements  
- `UI polish only`: refine field order for Thai data entry.
- `label/message only`: standardize all save/error/helper text in Thai.

Regression guard  
- create/edit still works
- Thai selectors still load and cascade correctly

### Products List
Route: `/products`

Purpose  
Scan and open products/services quickly.

Current strengths  
- Visual row with image and key fields is useful.
- Search works.
- Assistant context selection exists.

UX issues  
- For standard admins, the product list should optimize for decision speed more than technical product metadata.

UI issues  
- The table is good, but selected-state visibility and row action clarity can be improved.

Thai text/message issues  
- Ensure all empty/loading/fallback text is Thai.

Safe improvements  
- `keep current function, improve only wording/layout consistency`
- `UI polish only`: stronger selection feedback and more prominent primary row action.

Regression guard  
- list and search still work
- edit link still works
- selection still works

### Product Form
Routes: `/products/new`, `/products/:id/edit`

Purpose  
Create and maintain product/service master data.

Current strengths  
- Strong form base with admin meta, tax defaults, and Odoo image preview.
- Good preservation candidate because function is already rich.

UX issues  
- The page serves both normal admins and admin-capable users; advanced fields should be visually separated.
- Users need clearer distinction between sales behavior, purchase behavior, and accounting/tax behavior.

UI issues  
- Can benefit from stronger section cards and clearer disclosure of advanced fields.

Thai text/message issues  
- Subtitle still includes technical Odoo/API phrasing.
- Error text can be more business-friendly.

Safe improvements  
- `UI polish only`: split basic and advanced/admin fields.
- `label/message only`: reduce backend jargon in subtitle and helper text.

Regression guard  
- create/update still works
- tax defaults still apply
- admin fields still save correctly

---

## 6. Accounting and Tax Pages

### Accounting Reports Hub
Route: `/accounting/reports`

Purpose  
Serve as the entry point to accounting and tax reporting.

Current strengths  
- Broad and useful report coverage.
- Easy card-based entry.

UX issues  
- Reports and admin/setup are mixed together.
- Standard admin users may not distinguish operational report tasks from system setup.

UI issues  
- Card grid is easy to browse but not clearly grouped by purpose.

Thai text/message issues  
- `COA / Journals Admin` and `VAT Settings Admin` remain partly English.

Safe improvements  
- `layout/navigation only`: visually split report cards from setup/admin cards without removing any path.
- `label/message only`: Thai-first titles and subtitles.

Regression guard  
- every current card still navigates to the same route

### Profit & Loss
Route: `/accounting/reports/profit-loss`

Purpose  
Show income, expense, and profit by period with drilldown.

Current strengths  
- Real reporting page exists with tabbed detail and drilldown behavior.

UX issues  
- Filter and detail behavior is functionally good but needs more summary-first framing for standard admins.

UI issues  
- Report pages should emphasize summary before deep detail.

Thai text/message issues  
- Detail error wording and `Unknown error` fallback remain.

Safe improvements  
- `UI polish only`: stronger summary KPIs before table detail.
- `label/message only`: fully Thai loading, empty, and detail errors.

Regression guard  
- date filters still work
- detail drilldown still works

### Balance Sheet
Route: `/accounting/reports/balance-sheet`

Purpose  
Show assets, liabilities, and equity with drilldown.

Current strengths  
- Functional and drilldown-capable.

UX issues  
- Standard admins need clearer interpretation guidance.

Thai text/message issues  
- Several detail errors still use mixed phrasing.

Safe improvements  
- `keep current function, improve only wording/layout consistency`
- `workflow clarity only`: add short explanation text for how to read the sections.

Regression guard  
- report and drilldown still work

### General Ledger
Route: `/accounting/reports/general-ledger`

Purpose  
Expose account movement with drilldown context.

Current strengths  
- Route exists and report flow is intact.

UX issues  
- The page still sounds like a technical/accountant report rather than a guided admin report.

Thai text/message issues  
- Subtitle still references phase implementation language.

Safe improvements  
- `label/message only`: remove phase/dev wording from subtitle.
- `keep current function, improve only wording/layout consistency`

Regression guard  
- report still loads

### Trial Balance
Route: `/accounting/reports/trial-balance`

Purpose  
Show debit/credit/balance by account.

Current strengths  
- Stable report layout.

UX issues  
- For standard admins, interpretation help is useful but the underlying report is already solid.

Safe improvements  
- `keep current function, improve only wording/layout consistency`

Regression guard  
- data rendering unchanged

### Partner Ledger and Drilldown
Routes: `/accounting/reports/partner-ledger`, `/accounting/reports/partner-ledger/partner/:partnerId`

Purpose  
Show receivable/payable detail by partner.

Current strengths  
- Useful path from aging to partner detail.
- Drilldown route exists and is important.

UX issues  
- Partner-orientation should clearly explain whether the user is viewing customer-side or vendor-side balances.

Thai text/message issues  
- Page title and table titles still mix English.

Safe improvements  
- `label/message only`: Thai-first partner ledger language.
- `workflow clarity only`: clarify source context from aging or direct route.

Regression guard  
- drilldown navigation still works

### Aged Receivables / Aged Payables
Routes: `/accounting/reports/aged-receivables`, `/accounting/reports/aged-payables`

Purpose  
Help the user identify outstanding balances by aging bucket.

Current strengths  
- Report is business-actionable.
- Drilldown to partner ledger already exists.

UX issues  
- Buckets should visually emphasize overdue risk and next action.

Safe improvements  
- `UI polish only`: highlight overdue buckets more clearly.
- `workflow clarity only`: connect the report more clearly to follow-up collection/payment work.

Regression guard  
- partner drilldown still works

### Cash Book / Bank Book
Routes: `/accounting/reports/cash-book`, `/accounting/reports/bank-book`

Purpose  
Give users operational visibility into cash and bank movement.

Current strengths  
- Pages exist and support real accounting view.

UX issues  
- Need more practical framing for normal admins, not just accounting-report framing.

Safe improvements  
- `keep current function, improve only wording/layout consistency`

Regression guard  
- report load unchanged

### VAT / WHT Reports
Routes: `/accounting/reports/vat`, `/accounting/reports/wht`

Purpose  
Support Thai tax review and filing readiness.

Current strengths  
- Localized tax reports are present, which is high value.
- VAT page includes tax-loading and reporting logic.

UX issues  
- Tax pages should feel filing-ready and operational, not only report-oriented.
- WHT page still references phase status in subtitle.

UI issues  
- VAT and WHT should clearly separate summary, filters, and detailed lines.

Thai text/message issues  
- `VAT settings`, `source of truth`, phase wording, and some error fallbacks remain mixed.

Safe improvements  
- `label/message only`: Thai-first tax language across report and config pages.
- `workflow clarity only`: add "ตรวจสอบก่อนยื่น" framing.

Regression guard  
- VAT and WHT queries unchanged
- taxesQuery/reportQuery interactions unchanged

### Move Line Detail
Route: `/accounting/reports/move-lines/:moveLineId`

Purpose  
Show one accounting entry line and related journal entry context.

Current strengths  
- Valuable expert/admin page.

UX issues  
- This page is inherently technical; the main need is readability, not simplification of function.

Safe improvements  
- `keep current function, improve only wording/layout consistency`

Regression guard  
- move line detail still loads

### Accounting Admin
Route: `/accounting/admin`

Purpose  
Manage chart of accounts and journals safely.

Current strengths  
- Important admin function already exists.
- Create/update flows are already present.

UX issues  
- This page should be clearly treated as system-admin work, not standard daily accounting work.
- It should protect users from accidental misconfiguration by clearer wording and grouping.

UI issues  
- Table-form admin layout works, but sectioning and warnings can be stronger.

Thai text/message issues  
- Title and subtitles remain partly English.
- `Unknown error` fallbacks remain.

Safe improvements  
- `label/message only`: Thai-first admin wording.
- `workflow clarity only`: add explicit warning banner about accounting-impacting changes.
- `UI polish only`: separate accounts and journals into clearly labeled admin sections.

Regression guard  
- account create/update still works
- journal create/update still works

### VAT Settings Admin
Route: `/accounting/tax-settings`

Purpose  
Manage VAT/tax setup from backend configuration.

Current strengths  
- Essential tax admin function is present.
- Create/update/deactivate actions exist.

UX issues  
- Page needs clearer explanation of business impact and safe editing.

UI issues  
- Strong candidate for better sectioning and warning hierarchy.

Thai text/message issues  
- Title still English.
- Fallback error states still include `Unknown error`.

Safe improvements  
- `label/message only`: fully Thai admin tax wording.
- `workflow clarity only`: add clear warnings before deactivation and explanation of tax usage impact.

Regression guard  
- create/update/deactivate still work

---

## 7. Document Review, AI, and AI-Adjacent Pages

### Document Review Inbox
Route: `/accounting/document-review`

Purpose  
Keep approval queue and document review in one place to speed accounting processing.

Current strengths  
- Highly differentiated page.
- Combines approvals and document review.
- Supports review edits, retry parsing, unsupported marking, draft creation, AI suggestion context, and copilot.

UX issues  
- This is one of the most cognitively heavy pages in the app.
- It mixes approvals, OCR/extraction, accounting suggestion, AI copilot, partner matching, issue severity, and draft status.
- State/filter naming still reflects system pipeline concepts more than user tasks.

UI issues  
- Dense page with many competing information panels.
- Important status and confidence signals need stronger hierarchy.

Thai text/message issues  
- Many visible strings remain English:
  - `New`
  - `Needs review`
  - `Validation issue`
  - `Suggested draft ready`
  - `Linked`
  - `Pending review`
  - `Confirmed`
  - `Unsupported`
  - `Review Inbox`
  - `Copilot suggests. Accountants confirm.`
- Toast messages remain partially English:
  - `Approval action failed`
  - `Saved review changes`
  - `Retry parse queued`
  - `Draft creation failed`

Safe improvements  
- `label/message only`: fully translate review states, review statuses, assistant feedback, and toast messages into Thai business language.
- `workflow clarity only`: reorganize the page into "รายการรอตรวจ", "ผลสกัดข้อมูล", "ข้อผิดพลาด/คำเตือน", "ข้อเสนอจาก AI", "การสร้าง draft".
- `UI polish only`: stronger visual separation between document facts and AI suggestions.

What stays exactly the same  
- approval actions
- review update mutation
- retry parse
- mark unsupported
- create draft
- AI chat integration

Regression guard  
- approval queue still works
- detail load still works
- save review changes still works
- draft creation still works
- retry/unsupported still work

### Agent Dashboard and Agent Task Pages
Routes:
- `/agent`
- `/agent/ocr`
- `/agent/expense`
- `/agent/quotation`
- `/agent/contact`
- `/agent/invoice`

Purpose  
Provide AI-assisted specialist workflows for OCR and one-shot document/contact creation.

Current strengths  
- Useful specialist tools already exist.
- Concrete success outcomes are clear on task pages.

UX issues  
- These are not normal daily pages for all standard admins.
- Keeping them too visible in primary navigation may confuse non-AI-first users.

UI issues  
- Naming and entry points are inconsistent with the main ERP workspaces.

Thai text/message issues  
- Still mixed heavily:
  - `Agent Dashboard`
  - `AI-powered operations`
  - `Create Invoice`
  - `Create Quotation`
  - `Create Contact`

Safe improvements  
- `layout/navigation only`: visually position these under tools/admin or AI tools while preserving routes.
- `label/message only`: translate page titles, subtitles, and success/failure copy into Thai.

Regression guard  
- all agent flows still work from their current routes
- OCR/contact/quotation/invoice/expense actions unchanged

---

## 8. Reports Studio and Specialist Tools

Routes:
- `/reports-studio`
- `/reports-studio/branding`
- `/reports-studio/templates`
- `/reports-studio/editor/:templateId`
- `/reports-studio/preview/:templateId`
- `/reports-studio/print/:templateId`
- `/reports-studio/settings`

### Reports Studio Dashboard

Purpose  
Help a specialist user pick a template and continue into editing/preview/print.

Current strengths  
- Good focused dashboard for report specialists.

UX issues  
- This is not a normal daily accounting screen and should remain visibly specialist.

Thai text/message issues  
- Entire dashboard is English.

Safe improvements  
- `label/message only`: Thai-first specialist wording.
- `layout/navigation only`: keep as a specialist sub-product under tools/admin context.

Regression guard  
- template links still work

### Template Library

Purpose  
Manage default and custom templates safely.

Current strengths  
- Good read-only vs custom separation.
- Safe duplication workflow already exists.

UX issues  
- For Thai admins, template governance language should be clearer.

Thai text/message issues  
- Entire page is English.

Safe improvements  
- `label/message only`

Regression guard  
- ensure defaults
- custom template access
- duplicate path

### Editor

Purpose  
Edit report templates safely.

Current strengths  
- Strong specialist tool with save, save as, set default, record ID preview binding, block editing, and theme panel.
- Read-only default protection is already excellent.

UX issues  
- Appropriate for specialists; should not be simplified into a daily admin page.

Thai text/message issues  
- Still mostly English.

Safe improvements  
- `label/message only`: translate user-facing strings while keeping specialist meaning intact.
- `UI polish only`: no major workflow changes.

Regression guard  
- create copy
- save
- save as
- set default
- block editing

### Preview/Print

Purpose  
Show accurate document preview and print/PDF behavior.

Current strengths  
- Practical preview flow exists.
- Debug and guide controls are useful for specialists.

UX issues  
- Specialist-focused and acceptable as such.

Thai text/message issues  
- Most visible text remains English:
  - `Preview`
  - `Show guides`
  - `Loading DTO`
  - `Template not found`

Safe improvements  
- `label/message only`

Regression guard  
- preview still loads DTO
- print page still auto prints when configured

### Branding

Purpose  
Manage company-level branding and persist it.

Current strengths  
- Strong load/save/autosave structure.
- Remote/local status handling already exists.

UX issues  
- Suitable for admin/tools users, not daily operators.

Thai text/message issues  
- Most page copy remains English:
  - `Company Branding`
  - `Loading branding`
  - `Save failed`
  - `Unsaved changes`
  - `Branding details`

Safe improvements  
- `label/message only`

Regression guard  
- fetch/update branding still work

### Reports Studio Settings

Purpose  
Configure frontend-side Odoo/PDF settings for the studio.

Current strengths  
- Clear specialist settings page.

UX issues  
- Properly specialist; main concern is not visibility but wording.

Thai text/message issues  
- Entire page remains English.

Safe improvements  
- `label/message only`

Regression guard  
- autosave still works
- reset still works

---

## High-Priority Cross-Cutting Findings

### P1 Critical Workflow Clarity

- Split visual priority between daily admin work and management summary, especially on dashboard.
- Re-group primary navigation without breaking routes.
- Make lifecycle-next-action clearer on sales and purchase detail pages.
- Translate Review Inbox pipeline states into task-oriented Thai.
- Remove mixed English/technical labels from top-level navigation and critical actions.

### P2 Important Usability

- Standardize all user-facing alerts, toasts, loading, empty, and confirm messages in Thai.
- Replace raw browser confirms with in-app confirmation UI where behavior can remain identical.
- Improve one-hand mobile action placement on forms and detail pages.
- Reduce crowded header action rows by grouping secondary actions.

### P3 Polish and Consistency

- Standardize breadcrumb vocabulary.
- Standardize report subtitles to remove phase/dev wording.
- Normalize `Unknown error` into Thai fallback language everywhere.
- Use Thai-first names on specialist tools even if English appears as helper text.

---

## Implementation Safety Boundary

The following are safe to change without affecting existing function:

- labels
- subtitles
- breadcrumbs
- button text
- toast and alert wording
- section ordering inside a page
- visual grouping of actions
- iconography
- card grouping
- empty/loading/error state wording
- mobile layout behavior
- confirmation UI shell, if the underlying confirm behavior is preserved exactly

The following are not safe to change in this review implementation:

- API payload shapes
- mutation sequencing
- backend error-handling contracts
- route paths
- permission rules
- invoice/payment/e-Tax business logic
- sales/purchase document state logic
- tax/accounting computation logic
- Reports Studio storage model

---

## Regression Validation Matrix

Must pass after any UX/UI implementation:

- Login and logout
- Dashboard widgets and quick actions
- Sales order create, detail, confirm, print, invoice creation
- Invoice create, edit, post, register payment, edit payment, PromptPay, print/PDF, e-Tax, note creation
- Purchase request create, submit, cancel, create/open PO
- Purchase order confirm, cancel, receive, create/open vendor bill
- Expense list, detail, form
- Customer list, bulk activate/archive, detail quick actions, customer create/edit
- Product list and product create/edit
- Accounting reports navigation and drilldowns
- VAT/WHT reports and admin settings save
- Document review detail save, retry, unsupported, draft creation, approval actions
- Agent routes and tasks
- Reports Studio dashboard, templates, editor, preview, print, branding, settings

## Final Guidance

If implementation follows this review, the best strategy is:

1. Start with global copy and message normalization in Thai.
2. Rework visual grouping and action hierarchy on the highest-traffic operational pages.
3. Improve navigation grouping without breaking routes.
4. Handle specialist pages last, mostly as label/message containment work.

This sequencing preserves current function while steadily improving clarity for Thai standard-admin users.
