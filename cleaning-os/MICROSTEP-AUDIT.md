# CleaningOS — Complete Micro-Step Operating Audit

**Audit date:** 2026-11-18  
**Scope:** Current GitHub implementation of CleaningOS, with proposed platform ownership for MunkOS. **MunkOS source and live connected deployments were not audited.**  
**Sample business:** FreshStart Cleaning Co., two cleaners, 50 historical customers, Gmail + Google Calendar, considering a hosted website; sample deep-clean quote.

## How to read this

- **D · Demo workflow:** an in-browser action or state transition exists. Not evidence of real provider use, payment, or production readiness.
- **P · Partial:** some data/UI exists but a key connection, approval, or business requirement is absent.
- **M · Missing:** no functioning workflow was found in current CleaningOS code. This is **not** a claim that MunkOS lacks it.
- Statuses are **source-review findings**, not visual QA signoffs. Actual client acceptance must be verified separately with recorded evidence.
- Ownership lines identify a proposed split; confirm interfaces with MunkOS before implementation.

**Count:** 143 steps across 9 phases; **32 D**, **25 P**, **86 M**. These are coverage categories, *not* a weighted product-readiness score.

## 00 — Business onboarding

**Proposed owner:** MunkOS

| # | Micro-step | Coverage | Source-grounded observation |
|---|---|---|---|
| 00.01 | Create authenticated company/tenant | **M** | No tenant or isolation |
| 00.02 | Invite owner and staff users | **M** | No login or invitation |
| 00.03 | Choose solo/small-team/agency mode | **D** | Local Customize setting |
| 00.04 | Save operating company name | **D** | Browser-local field |
| 00.05 | Save verified contact details | **M** | No formal contact profile |
| 00.06 | Define cleaning service area | **M** | No radius or postcode rules |
| 00.07 | Set tax and currency policy | **M** | No invoice/tax engine |
| 00.08 | Define employee permissions | **M** | Crew is free text |
| 00.09 | Import previous customer records | **P** | Revive CSV only, not canonical CRM |
| 00.10 | Migrate historic jobs | **M** | No historic-job migration |
| 00.11 | Configure cleaning services and pricing | **P** | Basic calculator, not product catalog |
| 00.12 | Choose website onboarding path | **D** | Existing/hosted/undecided |
| 00.13 | Set domain preference | **P** | No domain registration |
| 00.14 | Define privacy, consent and retention | **M** | No company policy workflow |
| 00.15 | Activate paid subscription | **M** | No billing |

## 01 — Connections and website launch

**Proposed owner:** MunkOS + CleaningOS

| # | Micro-step | Coverage | Source-grounded observation |
|---|---|---|---|
| 01.01 | Inventory existing platforms | **D** | Six Connections cards |
| 01.02 | Record permission goal per platform | **D** | Read/draft/approved-action choice |
| 01.03 | Authorize Google Calendar | **M** | No live OAuth |
| 01.04 | Select calendar to synchronize | **M** | No authorized calendar picker |
| 01.05 | Sync events into scheduling | **M** | No real event integration |
| 01.06 | Authorize Gmail account | **M** | Reference link only |
| 01.07 | Authorize Meta accounts | **M** | No business account OAuth |
| 01.08 | Authorize Business Profile | **M** | No API entitlement |
| 01.09 | Register existing website URL | **P** | Reference only |
| 01.10 | Build hosted website draft | **P** | Local preview only |
| 01.11 | Customize visible service package tiles | **P** | Hardcoded preview categories |
| 01.12 | Edit home copy and call to action | **P** | Local preview editor |
| 01.13 | Replace hosted logo and photographs | **P** | Image URL preview, no uploads |
| 01.14 | Preview responsive published pages | **P** | No production site/device validation |
| 01.15 | Approve and publish site | **M** | No publishing worker |
| 01.16 | Configure domain DNS and TLS | **M** | No deployment pipeline |
| 01.17 | Draft website change request | **D** | Local unsent support draft |
| 01.18 | Deliver ticket to internal support | **M** | No backend queue |
| 01.19 | Restore a previous published version | **M** | No revisions/rollback |
| 01.20 | Audit public accessibility and speed | **M** | No deployment quality checks |

## 02 — Discovery and marketing

**Proposed owner:** CleaningOS + integrations

| # | Micro-step | Coverage | Source-grounded observation |
|---|---|---|---|
| 02.01 | Choose local target segments | **M** | No geographic campaign data |
| 02.02 | Record campaign concept | **D** | Spotlight draft concept |
| 02.03 | Create branded social post | **M** | No editor for post assets |
| 02.04 | Schedule social publication | **M** | No publisher integration |
| 02.05 | Read social channel results | **M** | No provider metrics |
| 02.06 | Update verified business listing | **M** | No Business Profile API |
| 02.07 | Track real landing-page traffic | **M** | No event telemetry |
| 02.08 | Attribute inquiry to origin | **P** | Source label, no UTM identifiers |
| 02.09 | Measure cost per lead | **M** | No spend inputs |

## 03 — Inquiry and qualification

**Proposed owner:** CleaningOS

| # | Micro-step | Coverage | Source-grounded observation |
|---|---|---|---|
| 03.01 | Generate sample website inquiry | **D** | Preview CTA creates sample lead |
| 03.02 | Receive actual public lead form | **M** | No live endpoint |
| 03.03 | Ingest inquiry from Gmail | **M** | No inbox connector |
| 03.04 | Capture text or missed call inquiry | **M** | No phone/SMS link |
| 03.05 | Deduplicate contacts and leads | **M** | No identity matching |
| 03.06 | Record inquiry source and timestamp | **P** | Source exists; full event lifecycle absent |
| 03.07 | Capture verified name and reply address | **M** | Sample lead lacks structured contact |
| 03.08 | Capture household street/ZIP | **M** | No structured address on lead |
| 03.09 | Capture bedrooms and bathrooms on lead | **M** | Estimator separate |
| 03.10 | Record requested service and date | **P** | Service and booking fields, not complete preference capture |
| 03.11 | Collect access and safety instructions | **P** | Manual onboarding notes |
| 03.12 | Check service-zone eligibility | **M** | No rules engine |
| 03.13 | Check appointment availability | **P** | Overlap warnings only |
| 03.14 | Assign lead owner | **M** | No authenticated assignee |
| 03.15 | Move lead through stages | **D** | Manual lead status |
| 03.16 | Set and rank follow-up due dates | **D** | FrontDoor due queue |
| 03.17 | Read connected message thread | **M** | Only manual notes |
| 03.18 | Send an approved reply from hub | **M** | Copyable draft only |
| 03.19 | Store consent and opt-out evidence | **M** | No canonical consent record |

## 04 — Quote, approval and booking

**Proposed owner:** CleaningOS + payments/core

| # | Micro-step | Coverage | Source-grounded observation |
|---|---|---|---|
| 04.01 | Model residential estimate | **D** | Beds/baths, clean type, frequency |
| 04.02 | Attach calculated quote to exact lead | **M** | Estimator separate |
| 04.03 | Model labor/supplies/travel | **P** | Labor and supply assumptions, not travel |
| 04.04 | Generate line-item proposal | **M** | No quote document |
| 04.05 | Send proposal to prospect | **M** | No mail delivery |
| 04.06 | Track viewed/approved/declined status | **M** | No verified lifecycle |
| 04.07 | Obtain signed customer approval | **M** | Manual assertion only |
| 04.08 | Secure deposit or payment authorization | **M** | No payment provider |
| 04.09 | Complete scope and onboarding checks | **D** | Five-step checklist |
| 04.10 | Choose appointment day and time | **D** | Required booking fields |
| 04.11 | Assign available cleaner | **P** | Free-text crew |
| 04.12 | Prevent conflicting bookings | **M** | Warnings not block |
| 04.13 | Create linked client and job | **D** | FrontDoor booking handoff |
| 04.14 | Prevent duplicate booking click | **D** | Job ID guard |
| 04.15 | Write approved event into calendar | **M** | No provider write |
| 04.16 | Send booking confirmation | **M** | No outbound integration |
| 04.17 | Store access codes securely | **M** | No safe secrets storage |
| 04.18 | Reschedule or skip appointment | **P** | Planner overrides, no customer update |

## 05 — Preparation, dispatch and execution

**Proposed owner:** CleaningOS + field identity

| # | Micro-step | Coverage | Source-grounded observation |
|---|---|---|---|
| 05.01 | Show work by week and team | **D** | Planner and run sheet |
| 05.02 | Allocate crew and travel buffer | **P** | Manual crew, no routing |
| 05.03 | Flag overlapping crew shifts | **D** | Operations overlap |
| 05.04 | Sign in assigned cleaner securely | **M** | No role-aware access |
| 05.05 | Show authorized home preferences | **P** | Unprotected client notes |
| 05.06 | Notify cleaner of new assignment | **M** | No push or email |
| 05.07 | Send customer reminder and ETA | **M** | No messaging |
| 05.08 | Record field start of service | **P** | Status change, not verified check-in |
| 05.09 | Work through room checklist | **D** | Six fixed checks |
| 05.10 | Record special tasks/supplies | **P** | Free text and simple add-on |
| 05.11 | Capture securely stored photo evidence | **M** | No photo backend |
| 05.12 | Record actual labor minutes | **D** | Operations.actual |
| 05.13 | Escalate damage/incident or rework | **M** | No incident queue |
| 05.14 | Require checklist before completion | **D** | Completion gate |
| 05.15 | Obtain supervisor/customer sign-off | **P** | Status only |
| 05.16 | Prepare completed-service report | **D** | Unsent Guided Demo report |
| 05.17 | Send report and receipt to customer | **M** | No delivery |

## 06 — Payments, economics and disputes

**Proposed owner:** MunkOS + CleaningOS

| # | Micro-step | Coverage | Source-grounded observation |
|---|---|---|---|
| 06.01 | Generate invoice with unique number | **M** | No invoice engine |
| 06.02 | Apply taxes/discounts to final amount | **M** | No accounting adjustments |
| 06.03 | Collect real payment | **M** | No provider |
| 06.04 | Track verified paid/unpaid/refund state | **M** | Simulation only in Revive |
| 06.05 | Reconcile payment to correct job | **M** | No transaction IDs |
| 06.06 | Monitor overdue invoice | **M** | No AR ledger |
| 06.07 | Refund, charge back, or adjust invoice | **M** | No ledger audit |
| 06.08 | Calculate estimated job contribution | **P** | Modeled cost only |
| 06.09 | Calculate realized net job margin | **M** | No actual paid costs or overhead |
| 06.10 | Export payroll/accounting transactions | **M** | No provider connection |

## 07 — Follow-up, retention and reputation

**Proposed owner:** CleaningOS + messaging

| # | Micro-step | Coverage | Source-grounded observation |
|---|---|---|---|
| 07.01 | Create aftercare from completed job | **D** | One linked record with dedupe |
| 07.02 | Draft customer check-in | **D** | Copyable check-in |
| 07.03 | Log manual external contact | **D** | Confirmed checkbox/action |
| 07.04 | Send automated approved check-in | **M** | No provider |
| 07.05 | Record private customer rating | **D** | Manual 1–5 and note |
| 07.06 | Open linked service recovery/rework case | **M** | No complaint ticket |
| 07.07 | Send unbiased review request from hub | **M** | Draft only |
| 07.08 | Mark review request externally sent | **D** | Manual confirmation |
| 07.09 | Read/respond to published Google reviews | **M** | No provider |
| 07.10 | Record attributable referral | **M** | No referral record |
| 07.11 | Compose recurring-cleaning offer | **D** | Copyable offer |
| 07.12 | Record recurring customer interest | **D** | Interest field |
| 07.13 | Convert interest to linked recurring schedule | **M** | Separate add-plan |
| 07.14 | Send repeat cleaning reminders | **M** | No messaging |
| 07.15 | Segment dormant customers | **P** | Revive imported/demo segments |
| 07.16 | Set up controlled reactivation experiment | **D** | Winback demo campaigns |
| 07.17 | Send legally permitted reactivation | **M** | No live sender |
| 07.18 | Match rebooking to real paid outcome | **M** | Simulation, not verified payment |
| 07.19 | Record service cancellation and reason | **M** | No offboarding workflow |

## 08 — Intelligence and business lifecycle closure

**Proposed owner:** MunkOS + CleaningOS

| # | Micro-step | Coverage | Source-grounded observation |
|---|---|---|---|
| 08.01 | Show active leads and booking counts | **D** | Command Center examples |
| 08.02 | Show scheduled work and quality exceptions | **D** | Operations summary |
| 08.03 | Show pending post-clean contacts | **D** | Aftercare pulse |
| 08.04 | Show verified cash, payments and receivables | **M** | No financial ledger |
| 08.05 | Compute lead response time and funnel rates | **M** | Missing event timestamps |
| 08.06 | Measure retention/churn cohorts | **M** | No historic event model |
| 08.07 | Calculate acquisition cost by channel | **M** | No ad spend integration |
| 08.08 | Offer rules-based recommendations | **P** | Basic exceptions, not trusted AI |
| 08.09 | Execute approved recommendations | **M** | No workflow engine |
| 08.10 | Deliver scheduled owner reports | **M** | Manual report only |
| 08.11 | Export complete business records | **M** | No tenant export |
| 08.12 | Revoke team user access | **M** | No auth |
| 08.13 | Revoke provider OAuth permission | **M** | Clearing a reference is not revocation |
| 08.14 | Close tenant and terminate subscription | **M** | No lifecycle |
| 08.15 | Apply retention/deletion policy | **M** | No controlled deletion |
| 08.16 | Restore business records after failure | **M** | Browser-local persistence only |

## Red-flag handoffs

1. **Existing Guided Demo bypasses FrontDoor** — creates a customer directly. Rewrite to use the same lead, quote and job IDs as the normal flow.
2. **Quote isn't attached to the lead** — calculator and manually confirmed quote amount exist, but no customer-facing quote object, itemization or acceptance evidence.
3. **Scheduling warns instead of prevents** — crew overlap detection runs after bookings; booking lacks provider availability and conflict enforcement.
4. **Quote value is not collected revenue** — reports model quoted service value and contribution; no invoice, payment, refund or reconciliation.
5. **Provider links aren't OAuth connections** — Connections saves plans and references only. Don't advertise synced Calendars, Gmail, Instagram or websites.
6. **Website draft isn't a live website** — no publish, rollback, domain registration, file upload or support ticket delivery.
7. **Manual outreach isn't delivered communication** — copied messages and manually logged contact are useful demo steps, not verified sends or customer opt-in.
8. **Aftercare interest isn't a recurring booking** — recorded interest does not create an approved repeating plan.
9. **Shared-engine ownership isn't yet verified** — don't build new tenant/auth/calendar/payment engines here without aligning MunkOS interfaces.
10. **Guided Demo restart should remove linked aftercare** — verify or fix orphan ledger records when a sample job is removed.

## P0 full-path acceptance test (one customer)

- [ ] Create/select business and website route with a valid domain preference; reload and confirm safe local state
- [ ] Record Calendar/Gmail as **reference-only** setup plans, not connected
- [ ] Generate customer inquiry from site CTA; confirm lead source and stable identifier
- [ ] Add conversation note; collect home details, service scope, scheduling preference and contact permission
- [ ] Create quote **for that lead**, obtain recorded approval, verify exact amount
- [ ] Validate crew availability; choose date/time/crew; confirm onboarding checklist
- [ ] Book once; verify same lead, client, job and appropriate week; block duplicate
- [ ] Update job stage and actual minutes; block incomplete quality checks
- [ ] Complete service; create exactly one aftercare record across reloads
- [ ] Record contact; manage neutral review request and private rating; note any complaint
- [ ] Record recurring offer interest and, if accepted, create a genuine linked repeating plan
- [ ] Verify dashboard funnel, quoted vs paid amounts, and pending actions without fabricated financial results
- [ ] Test malformed data, bad provider URLs, denied permissions, multiple clients and browser refreshes

## Recommended build order

**P0, CleaningOS:** fix the actual demo's FrontDoor bypass; unify identity/quote/booking chain; cover cancellation and reschedule; verify crew conflicts and post-service closure; create a real in-app test harness with visible pass/fail checkpoints.

**P0, MunkOS shared core (verify current status first):** tenants/users/RBAC, canonical IDs, event bus, audit, source-of-truth DB, sync outbox/idempotency, durable scheduling, secure credentials, support work queue.

**P1, integration:** Google Calendar read-only OAuth and selection → approved create/reschedule with conflict checks → website hosted CMS/publish rollback → ticket delivery → email sending with consent checks.

**P1, money:** itemized quotes and approval, invoice, payment reconciliation, refunds, accurate collected-revenue/reporting split.

**P2, growth:** real review-provider signals, referral attribution, automated consent-safe lifecycle campaigns, cohort retention, actionable intelligence.

## Proposed MunkOS ↔ CleaningOS interface contract

Canonical entities: `tenant`, `user`, `customer`, `lead`, `quote`, `service_job`, `team_assignment`, `provider_connection`, `message`, `consent_record`, `invoice`, `payment`, `review_request`, `support_ticket`.

Proposed events (not deployed): `lead.created`, `quote.created`, `quote.accepted`, `job.scheduled`, `job.rescheduled`, `job.completed`, `invoice.paid`, `aftercare.due`, `review.requested`, `recurring.accepted`, `ticket.created`, `connection.expired`.

Every mutation should include `tenant_id`, authenticated actor, timestamp, source system and idempotency key; external actions require explicit permissions, consent where applicable, and an auditable result. IDs must survive provider retries and screen transitions.

## Audit evidence and caution

Reviewed source files: `app.js`, `lifecycle.js`, `frontdoor.js`, `operations.js`, `planner.js`, `winback.js`, `studio.js`, `aftercare.js`, `journey.js`, `INTEGRATIONS.md`, `PILOT-ACCEPTANCE.md`. Existing seven-step Guided Demo was run programmatically in an earlier review; it succeeded in operational steps but did not create a linked FrontDoor lead.

This inventory is intentionally strict. Mark **D/P/M** only after implementation evidence changes. Add a separate **PASS** column after actual browser test and a production **VERIFIED** state after real external integration tests.
