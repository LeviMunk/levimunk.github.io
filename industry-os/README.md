# Industry OS | Remote working guide

This workspace lives in GitHub. You do not need the home ThinkCentre to edit HTML, CSS, JavaScript, research notes, or project plans.

## Start here (any browser)

- Hub source: https://github.com/LeviMunk/levimunk.github.io/blob/main/industry-os/index.html
- Entire repo in browser-based VS Code: https://github.dev/LeviMunk/levimunk.github.io
- Intended public hub: https://levimunk.com/industry-os/

The public route has NOT been verified. If it returns 404, do not assume the source is missing; diagnose the actual hosting platform and whether the published site uses the repo root, generated artifact, or a Cloudflare route. Avoid modifying the LeviOS Trading worker build blindly.

## Prototypes

- Real Estate OS: `real-estate-os/index.html`
- HVAC OS: `hvac-os/index.html`
- Plumbing OS: `plumbing-os/index.html`
- Landscaping OS: `landscaping-os/index.html`
- Cleaning OS: `cleaning-os/index.html`
- Contractor OS: `contractor-os/index.html`

All numbers are synthetic demonstration data. No MLS, CRM, field-service or payment APIs are connected.

## Prioritized development milestones

1. **Publishability:** Verify custom domain DNS, GitHub Pages publishing source, Cloudflare Pages settings, and whether Cloudflare Workers intercept the paths. Check each route with real browser status codes. Do not break `/` or `/levios-trading/`.
2. **Customer discovery:** Interview at least five real agents or service company operators. Record actual workflows, software names, costs, and a time or revenue consequence.
3. **Shared components:** Extract the common UI and the software-savings tool into reusable, separately versioned assets, while retaining tailored industry interfaces.
4. **One real workflow:** Prioritize an authorized read-only integration or structured CSV import, then establish baseline metrics before any automation.
5. **Safety:** Keep tokens, contact information, CRM records, and proprietary MLS feeds out of GitHub Pages. API calls with credentials belong in a protected backend.
6. **Viability:** Compare annual savings against subscriptions, hosting, support, training, migration, and ongoing changes.

## First pilot hypotheses

### HVAC

- Missed inquiries and estimate follow-ups might represent lost revenue.
- Active maintenance agreements may be a recurring revenue lever.
- Field-service suites may be costly but replacing dispatch and payment tools could be riskier than connecting them.

### Real estate

- One dashboard for leads, listing engagement, and routine seller reports may reduce context switching.
- MLS access, permitted data uses, CRM API access, and brokerage contracts must be validated first.
- Subscription consolidation only makes sense if agents can actually cancel the replaced tools.

## Tomorrow's three concrete outputs

1. Decide which industry can give us the fastest five customer interviews.
2. Capture the current software stack and one expensive workflow for a hypothetical customer; distinguish assumptions from evidence.
3. Build one improved screen that directly targets that workflow, then commit it via github.dev.

## Remote editing

Open the repo in `github.dev`, edit the files, use Source Control to commit, and verify the GitHub commit appears. GitHub.dev is a browser editor, not a full local server, and committing does not guarantee a site deployment. Avoid sensitive work on an employer-managed device or account.
