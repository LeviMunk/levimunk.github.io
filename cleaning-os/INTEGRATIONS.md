# CleaningOS — Connections and Website Studio

## Shipped in build 11.18e

This is a browser-local prototype, not an OAuth application or a hosted website management service.

- **Connections:** six provider cards, desired permission level, non-secret setup notes, optional link references, clear *Not configured / Setup planned / Reference saved only* statuses. These statuses are not live provider authentication or sync success.
- **FrontDoor → Website Studio:** choose existing website / hosted website / undecided; record platform, URL, possible domain, setup requirements. Preserve existing site preview and editing of headline, supporting text and CTA; add a URL-based hero-image preview.
- **Change requests:** create locally stored, unsent drafts with category, priority and details; copy a draft to send manually. No support requests are delivered automatically and no domain is bought or checked.
- **All current CleaningOS modules:** unchanged: seven customer lifecycle sections, FrontDoor lead handling, Flow jobs, aftercare ledger, and browser-based persistence.

### Design rules

1. Never label a provider connected until a backend has verified an actual OAuth grant and provider API call.
2. Never request usernames, passwords, OAuth tokens, API keys, or customer secrets in browser-local storage or an unencrypted frontend field.
3. Domain choice is an idea only. Clients should register and retain ownership of their domains and have the option to export their content.
4. Preview changes are not public website edits. A future publish action must show the exact diff, permission holder, destination and rollback options.
5. Client support tickets are not "submitted" until an authenticated backend records them and a support notification is acknowledged.
6. Link references should be validated to HTTP(S) and always opened with `noopener noreferrer`. Treat all website content and linked providers as untrusted.

## Planned production backend (not yet built)

**Identity and tenancy:** owner login, role-based permissions, company-specific row-level data partitioning, owner-controlled integration grants/revocation, immutable audit events.

**Google Calendar first:** verified OAuth with minimum viable scopes, callback/refresh handling on server, per-tenant encrypted credentials, calendar selection, initial read-only event listing, then explicit approval for create/reschedule, conflict resolution, idempotency keys, rate limits and sync failures. The connector's capabilities should reflect the exact approved OAuth scopes.

**Gmail:** consider restricted/verified OAuth scopes, explain privacy, present read-only/inbox access separately from drafting and sending; never send messages without owner approval, retain opt-out and contact permissions.

**Meta/Google Business Profile:** provider eligibility, business account requirements, scopes and review. Do not show a generic connect control until provider app review and supported endpoints are confirmed.

**Website hosting:** production site template(s), deployment pipeline, authenticated limited-field CMS, asset storage, image rights, preview and publish approvals, version history, rollback, domain DNS validation/TLS, backups, and accessibility/performance testing. An existing WordPress/Squarespace site must be treated differently from a CleaningOS-hosted site.

**Support:** authenticated request create/read/update endpoints, support notifications, comments, quotes and customer approval, clear states and SLA. Client sees only their own tickets; internal MunkOS staff can manage assigned requests.

**Suggested internal API boundaries (design sketches, not endpoints):**
- `GET /integrations`, `POST /integrations/{provider}/start`, `GET /integrations/{provider}/callback`, `DELETE /integrations/{provider}`
- `GET /calendar/events`, `POST /calendar/approved-event`
- `GET /website/config`, `PATCH /website/draft`, `POST /website/publish-request`
- `GET /support/requests`, `POST /support/requests`, `POST /support/requests/{id}/approval`

**Milestone gates:**
1. Authenticated tenant storage and migrations, including safe import from local demo only on explicit consent.
2. Google Calendar **read-only** integration and status/error reporting.
3. Safe approved event creation with conflict checks and rollback information.
4. Hosted website publish and rollback for approved business template fields.
5. Support ticket submission and staff response workflow.
6. Additional integrations only after a provider-specific permissions and security review.

## Testing notes

Source-level checks cover Studio setup options, unsafe URL rejection, request drafts/copy, image preview, page navigation and all prior FrontDoor tabs. This is not an end-to-end live OAuth, hosted publishing, browser visual or production security test.
