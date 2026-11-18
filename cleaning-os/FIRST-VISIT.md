# CleaningOS customer-facing Step 00.01 — First Visit

**Status:** Built in demo; source-level interaction tests passed (2026-11-18).  
**Version:** 11.18f  
**Note:** The original backend-oriented MICROSTEP-AUDIT.md 00.01 is authenticated tenant creation. This user-facing step is **UX 00.01**, preceding backend tenant creation in the onboarding experience.

## Expected first-time behavior

- New browser with no saved CleaningOS demo or entry choice displays a clean full-width welcome page, not the populated Command Center.
- Clear two routes: **Explore the demo** and **Set up my business**.
- Explains value across inquiries, operations and recurring relationships without claiming integrations are live.
- Displays explicit prototype disclaimer: the demo is fictional, no live registration or payments.
- Both routes work without requiring a credit card or creating a fake account.

## Existing users

- Existing browser-local demo records continue opening Command Center by default.
- Returning users who chose the setup path return to setup until they explicitly choose Explore Demo.
- Welcome & Start and Business Setup are still accessible in All Tools.
- No demo customers, quotes, jobs or aftercare records are destroyed when entering setup or welcome.

## Setup draft

- Business name, team size, current website situation and list of existing tools.
- Stored separately as `setupDraft` in browser-local demo data.
- This is *not* an authenticated business, published website, provider connection, paid subscription or shared MunkOS tenant.
- Clicking Explore Demo preserves setup draft and takes user into fictional CleaningOS business.

## Implementation

- New `welcome.js`: welcome and setup views, draft validation/persistence.
- `app.js`: first-time gate, returning-user compatibility, actions, setup form handler.
- `app.css`: full-width premium welcome design + responsive setup, avoids altering FrontDoor layout.
- `index.html`: deferred script and versioned assets.

## Validation completed

Source-level browser-like DOM/action tests:
1. New visitor sees Welcome rather than Command Center.
2. Setup path opens and renders inputs.
3. Draft saves; remains distinct from fictional existing business.
4. Setup draft survives simulated reload.
5. Explore Demo opens Command Center.
6. Returning demo directly opens Command Center.
7. Welcome remains accessible to returning visitors.
8. JavaScript syntax checks passed.

## Outstanding

- Real Firefox and mobile browser visual acceptance.
- Real authentication, account creation and tenant storage belong to MunkOS core once confirmed.
- Guided 2nd/3rd onboarding steps and integration connection grants are future work; do not imply they exist.
- Optional future product choice: whether all new visitors should see Welcome or whether demo/public landing should be a separate URL.

## Acceptance criteria for live release

No claims of live OAuth, server persistence, production accounts or billing. Once MunkOS auth is integrated, the Setup CTA should use the authenticated company-creation flow and store server-validated company context. Demo mode must remain isolated.
