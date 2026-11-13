# LeviOS Trading Lab — Private Alpaca PAPER account, no DNS changes

**Chosen architecture (November 2026):** Keep `https://levimunk.com/levios-trading/` hosted on GitHub Pages and the domain registration/DNS wherever they already are. Deploy the **same dashboard UI**, plus a **read-only Alpaca PAPER API**, to a private Cloudflare Worker on `https://levimunk-alpaca.levivanstap.workers.dev/`.

The Access-protected Worker is what you open from any computer or phone to see your **actual Alpaca PAPER** account. The existing public GitHub Pages page remains available for browsing and browser-only practice. The two URLs share **code** but not browser localStorage, because the origins are different.

**Deployment:** Cloudflare originally deployed this Worker under a different name on November 12, 2026; the owner has since renamed it to `levimunk-alpaca`. The secure account experience is **not yet enabled** until you protect the Worker with Cloudflare Access and add your private secrets. None of these steps transfers your domain, changes Bluehost DNS, requires your ThinkCentre to be online, or requires paid hosting at small personal usage levels.

## Current Cloudflare build configuration (root directory)

**Already fixed in GitHub:** The repository now includes root-level `build.mjs` and `wrangler.jsonc` compatibility files. This allows Cloudflare's existing root-directory build settings to work unchanged:

- **Root directory:** leave blank (repository root)
- **Build command:** `node build.mjs`
- **Deploy command:** `npx wrangler deploy`
- **Production branch:** `main`
- **Worker name:** `levimunk-alpaca`

Cloudflare successfully ran `node build.mjs` and `npx wrangler deploy` from the root of the repository. Both root and nested Wrangler configuration files now match Cloudflare's actual deployed Worker name, `levimunk-alpaca`. Continue with Access and secrets; don't create a second Worker.

If you already set root directory to `levios-trading/worker`, the original `node build.mjs` and `npx wrangler deploy` commands still work there as well. **Do not combine a nested root directory with a root-prefixed command.**

## One-time steps in Cloudflare (no command line necessary)

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/). Your existing Worker is **Workers & Pages → `levimunk-alpaca`**. Do not create another Worker or add/transfer `levimunk.com`. There is no DNS step.
2. GitHub integration for **`LeviMunk/levimunk.github.io`** and production branch **`main`** already deployed successfully. This step is complete.
3. Existing deployment configuration (for reference; already working):
   - **Worker name:** `levimunk-alpaca` (matches deployed Cloudflare project and both Wrangler configs)
   - **Root directory:** `levios-trading/worker`
   - **Build command:** `node build.mjs`
   - **Deploy command:** `npx wrangler deploy`
   - **Worker URL:** enabled; Cloudflare supplies `https://levimunk-alpaca.levivanstap.workers.dev/`.
   - If Cloudflare requires a package manager or dependencies, use the default available Node runtime for the build; no extra npm packages are used by the project build.
4. **Next action: protect the entire Worker**: open that Worker in Cloudflare **Workers & Pages → Access → Protect this Worker behind Access → All traffic** (not just previews). Configure an **Allow policy for your own exact email address** and an identity method you control (such as an email one-time PIN). Do **not** choose Everyone, an entire email domain, or "Previews only". Make sure the policy applies to the production `workers.dev` URL.
5. After enabling Access, in the same Worker open **Settings → Variables and Secrets**, add **three secret variables** (Secret type, NOT plaintext): `ALLOWED_EMAIL` (the same login email authorized above), `ALPACA_PAPER_KEY_ID` and `ALPACA_PAPER_SECRET_KEY`. Use **paper**, not live broker credentials. Cloudflare will no longer show these values after they are stored. Never paste the secrets into ChatGPT, GitHub, public JS, or screenshots.
6. Visit the exact `https://levimunk-alpaca.levivanstap.workers.dev/` URL. You should see the Cloudflare Access login, then the **same LeviOS Trading interface** you already use, but with actual Alpaca PAPER equity, cash, buying power and positions as the primary cards. Click **Connect / Refresh** if needed.
7. From your work computer or phone, visit the **same protected Worker URL**, complete login, and see Alpaca PAPER balances. Bookmark this secure URL. No VPN client, separate host, DNS migration, or home computer is required.
8. (Optional) Visit `https://levimunk.com/levios-trading/` and paste your real Worker URL into its **Private Cloudflare Worker address** field; click **Open secure Alpaca dashboard**. This saves only the URL in that browser, never any secrets. Once you share the *public* `workers.dev` hostname (not secret), ChatGPT can hardcode a link from your portfolio if desired.

**Important:** Until both the Access policy and secret `ALLOWED_EMAIL` are configured, the Worker intentionally returns `403` even if its URL is known. This is expected: the app fails closed instead of exposing Alpaca financial information.

## How updates work

- All source is in **one GitHub repository**: `LeviMunk/levimunk.github.io`.
- The public frontend source stays in `levios-trading/index.html`, `app.js`, and `styles.css`.
- The private read-only backend stays in `levios-trading/worker/src/index.mjs`.
- `levios-trading/worker/build.mjs` packages the **same frontend files** into the Worker on every build.
- Once Git integration is enabled, pushes to `main` automatically build and deploy the Cloudflare Worker. GitHub Pages continues to serve the public portfolio separately.
- The private Worker is **read-only**. It never submits Alpaca paper or live orders. The $10,000 browser simulator is completely separate from your Alpaca paper account.

## Why a separate private URL?

GitHub Pages does not have a secure server-side secret store or application authentication and cannot safely access your Alpaca credentials. Also, workplace browsers often block third-party cookies used by Access across websites. Serving the dashboard and its API on the same authenticated `workers.dev` origin avoids that cookie issue.

Cloudflare Access enforces login **before** the Worker is invoked. The Worker also explicitly checks `ctx.access.getIdentity()` and matches its email to the `ALLOWED_EMAIL` secret, so an accidentally unprotected deployment returns `403`. No Cross-Origin Resource Sharing (CORS) is enabled.

## Troubleshooting

- **Worker says `403 Authenticated Cloudflare Access session required`**: After the latest GitHub deployment, open `https://levimunk-alpaca.levivanstap.workers.dev/api/health` and read its non-sensitive `reason` code:
  - `access_not_authenticated`: Cloudflare did not provide an authenticated Access context. In **Workers & Pages → levimunk-alpaca → Access**, confirm **All traffic** is protected for **production** (not Previews only), apply policy for your exact account, and sign in again in a private browser window. This is an Access policy/configuration issue, not an Alpaca issue.
  - `allowed_email_not_configured`: Add `ALLOWED_EMAIL` under **Settings → Variables and Secrets**, secret type, matching the email that logs into Access. Save/deploy.
  - `allowed_email_mismatch`: Access authenticated somebody, but the Worker secret `ALLOWED_EMAIL` does not match the signed-in email. Fix the secret or log in with the intended account. This diagnostic intentionally does not reveal the email.
  - `access_identity_unavailable`: Cloudflare Access could not supply the identity. Check your policy and login; don't bypass Access.
  If the response still has no `reason`, Cloudflare hasn't deployed the updated code yet. Check **Deployments** for a new successful GitHub build. Never disable authentication to troubleshoot.
- **Main balance shows `—` / "Alpaca disconnected"**: Your Access session may have expired; try logging in to the protected Worker URL, and verify the two Alpaca paper secrets are set. No credentials should be entered in the public site.
- **Alpaca API says `connected: false`**: After the latest GitHub deployment, open `https://levimunk-alpaca.levivanstap.workers.dev/api/alpaca/status` while signed into Cloudflare Access. Copy only the harmless `reason`, `endpoint`, and optional `http_status` fields when asking for help. The Worker does not return any credentials, account number, or raw Alpaca response.
  - `alpaca_credentials_rejected` (401/403): Confirm both secrets form a matching **PAPER** key pair in Cloudflare; live keys cannot be used with the paper endpoint.
  - `alpaca_rate_limited` (429): Wait before refreshing repeatedly.
  - `alpaca_service_error` (5xx): Alpaca rejected the request due to a server-side error; retry after checking its service status.
  - `alpaca_http_error`: Check the accompanying safe `http_status` number.
  - `alpaca_timeout` / `alpaca_network_error`: An outbound connection from the Worker to Alpaca failed; this does not prove credentials are wrong.
  - `alpaca_invalid_response`: Alpaca returned unexpected JSON or missing expected account fields.
  - `alpaca_paper_secrets_missing`: Configure both `ALPACA_PAPER_KEY_ID` and `ALPACA_PAPER_SECRET_KEY` as private Worker secrets.
  - No `reason` field: Cloudflare has not yet deployed the updated Worker code; check the Worker Deployments tab.
  Never put API key values in GitHub, chat, browser JS, or screenshots.
- **Build fails to find `generated-assets.mjs`**: Keep **Root directory** blank with **Build command** `node build.mjs` and **Deploy command** `npx wrangler deploy`, then redeploy. The root-level build script creates the generated file in the nested Worker folder.
- **Build cannot deploy**: Verify Worker name is exactly `levimunk-alpaca`, and Git integration is connected to the correct repo and main branch.
- **Public `levimunk.com` page still defaults to disconnected**: Expected; the public page is not the authenticated account page. Use the secure Worker URL.
- **Existing browser-simulated trades missing on Worker**: Browser localStorage does not sync between origins. The original practice data remains on `levimunk.com`; it can be exported/imported manually.
- **Privacy:** this is a personal project for read-only Alpaca paper data. Do not permit other users unless you intend to share your Alpaca account information.

## Source documentation

- [Cloudflare Workers GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/)
- [Cloudflare Access protection for one Worker](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [workers.dev routing without onboarding a domain](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
