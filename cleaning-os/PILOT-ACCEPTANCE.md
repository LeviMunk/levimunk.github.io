# CleaningOS first example-business acceptance run

Date: 2026-11-18. Demo is fictional browser-local data. MunkOS core-engine source was **not** verified during this review.

## Purpose

Test one *complete* cleaning-business journey, from setup and inbound lead to cleaning and repeat service, before investing in another feature. A clean UI is not proof of an end-to-end system.

### Test company (hypothetical)
FreshStart Cleaning Co.; two cleaners; 50 historical customers; Gmail and Google Calendar currently used; no maintained website; new customer seeking a $240 deep clean.

## Current coded Guided Demo baseline

Ran seven steps programmatically using `CleaningJourney.advance` and the loaded CleaningOS modules. All seven returned `ok:true`.

- Step 1 creates a customer directly, **not a FrontDoor lead**.
- Step 2 creates a fictional $195 quote.
- Step 3 creates a scheduled job.
- Steps 4–6 move the job to Cleaning, pass six checks, and mark Completed.
- Aftercare ledger creates one record when completion is synced, but this record has no linked FrontDoor inquiry.
- Step 7 prepares a completion report, not delivered externally.
- No actual Gmail/Google Calendar integration, public site publishing, customer messaging, ticket submission, or payments occur.

This is a functioning **operations showcase**, not a full end-to-end acceptance test.

## First acceptance scenario (must test in the actual UI)

1. **Onboard business:** choose Hosted website in FrontDoor Website Studio, record domain preference, edit headline, copy, CTA and hero photo. Confirm changes survive reload. Expected: preview-only; no real domain is acquired or website published.
2. **Connection inventory:** record an existing Gmail and Google Calendar plan. Expected: status is explicitly 'Reference saved only', **never Connected**. Note the business owner must authorize actual OAuth after MunkOS integration backend is ready.
3. **Lead acquisition:** click sample website CTA and confirm FrontDoor creates an inquiry. Expected: one stable lead ID and source = Website.
4. **Contact and estimate:** enter customer conversation note and a quote, then confirm onboarding scope. Expected: notes and quote persist; no customer message is claimed sent.
5. **Schedule:** select visit date/time and assigned cleaner, complete all five onboarding checks and confirm booking. Expected: exactly one client and one Flow job; matching lead ID and job ID survive reload. A duplicate booking attempt is blocked.
6. **Operational flow:** visit Flow/Weekly Planner/Jobs. Expected: booking is locatable on its intended week, with crew and date; conflicts are visible. Update stage, complete all six service checks, enter actual labor and mark Completed. Incomplete checklist cannot be marked completed.
7. **Aftercare:** view new post-clean follow-up in Flow and copy check-in draft. Expected: one linked aftercare record; nothing sent automatically. Mark externally contacted only after explicit operator confirmation.
8. **Retention:** in Elevate copy a recurring-care offer and manually record interest. Expected: interest updates the same aftercare/customer record. 'Interested' is not misrepresented as a scheduled recurring cleaning.
9. **Reputation:** in Echo copy an unbiased review request, record actually sending it externally, and enter received customer feedback. Expected: review action is not gated by positive rating; it doesn't publish a review.
10. **Support request:** submit a fictional redesign request in Website Studio, copy it and check its status. Expected: clearly 'Saved locally / not delivered', **not** a delivered support ticket.
11. **Manager view:** verify Command Center shows relevant follow-ups and service metrics. Reload browser. Expected: IDs and states persist without duplicate jobs/aftercare; locally stored data clearly labeled fictional.
12. **Failure cases:** invalid URL, rejected calendar authorization (future), missing time/crew, duplicate click, malformed localStorage, failed sync (future), and permissions errors (future). Expected: explain failure, allow recovery, never fabricate success.

## Production readiness gates

- **Gate A — demo workflow:** one linked scenario runs in actual browser, no misleading statuses, no duplicate records, consistent IDs and usable mobile presentation.
- **Gate B — platform core:** MunkOS ships authenticated tenant and user identity, RBAC, row-level isolation, audit log, server-side encrypted credentials and job scheduler; CleaningOS consumes APIs instead of copying those engines.
- **Gate C — integration:** real Google Calendar read-only OAuth and sync, with honest connected/expired/error states, calendar selection and conflict handling; then create/update only after explicit approval and permission.
- **Gate D — website:** controlled CMS, file upload, real preview/publish/rollback, domain setup with client ownership.
- **Gate E — communications/support:** approved drafts and sending, delivery status, consent/unsubscribe rules, authenticated change requests routed to MunkOS support.
- **Gate F — billing/reporting:** paid invoices and actual cost/revenue attribution distinguished from quotes and simulated data.

## Ownership split

### MunkOS core (shared for all IndustryOS variants)
- tenants, users, roles, secure provider OAuth and token vault
- integration adapter SDK, sync state/error/audit logs, retry queues
- common person/company/contact records and messaging approvals
- website CMS/publishing pipeline, tickets and internal support workspace
- payments/billing primitives, workflow/automation framework, analytics event definitions

### CleaningOS industry implementation
- service catalog, property/home details and scope
- crew availability, job duration, cleaner dispatch, checklists, on-site execution
- cleaning-specific quote, repeat-service rules and consent-sensitive follow-ups
- field display/UX for Spotlight, FrontDoor, Flow, Elevate, Echo, Revive and Nexus

### Shared interface contracts to agree before parallel work
- `tenant_id`, `customer_id`, `lead_id`, `job_id` and `external_event_id` stable identifiers
- `lead.created`, `quote.approved`, `job.scheduled`, `job.completed`, `aftercare.due`, `feedback.received` event names and payloads
- approval/consent record format, user actor, timestamp and source
- provider connection states: disconnected, authorization_pending, connected, expired, error
- idempotency keys for calendar events, messages, support tickets and job handoffs
- backend ownership of source-of-truth, with client cache read-only until approved mutation

## Immediate work order

1. **Do not start a second integration backend inside CleaningOS.** Review MunkOS status and agree contracts.
2. Repair the Guided Demo's bypass of FrontDoor; make a unified example scenario that reuses FrontDoor records instead of creating an unrelated client.
3. Run actual Firefox desktop and mobile acceptance steps 1–12, logging screenshots/bugs.
4. Integrate one shared MunkOS backend capability, ideally authenticated tenant state, before Google OAuth.
5. Do not market as 'live connected' until gates B–E are satisfied.

## Evidence

2026-11-18 source-level run executed the seven legacy Guided Demo transitions successfully. One aftercare record was generated, but the completed job could not be traced to a FrontDoor lead. This is not a graphical browser test or proof of production readiness.
