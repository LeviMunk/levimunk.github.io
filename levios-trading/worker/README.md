# LeviOS Trading Lab — Private Alpaca PAPER account, no DNS changes

**Chosen architecture (November 2026):** Keep `https://levimunk.com/levios-trading/` hosted on GitHub Pages and the domain registration/DNS wherever they already are. Deploy the **same dashboard UI**, plus a **read-only Alpaca PAPER API**, to a private Cloudflare Worker on `https://levimunk-alpaca.levivanstap.workers.dev/`.

The Access-protected Worker is what you open from any computer or phone to see your **actual Alpaca PAPER** account. The existing public GitHub Pages page remains available for browsing and browser-only practice. The two URLs share **code** but not browser localStorage, because the origins are different.

**Deployment:** Cloudflare originally deployed this Worker under a different name on November 12, 2026; the owner has since renamed it to `levimunk-alpaca`. Cloudflare Access has been verified and the PAPER account API connection has returned `connected: true`. Both production protection and private secrets must stay configured. None of these steps transfers your domain, changes Bluehost DNS, requires your ThinkCentre to be online, or requires paid hosting at small personal usage levels.

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

## Alpaca PAPER profit/loss chart (November 2026)

The signed-in Worker dashboard now displays an **Alpaca PAPER profit/loss chart** with **1W, 1M, 3M and 1Y** periods, plus percentage return, reported P/L, reference equity and chart dates. It uses Alpaca's official `GET /v2/account/portfolio/history` endpoint through the same protected Worker; **no API keys are exposed to browser code**.

- Worker API: `GET /api/alpaca/history?range=1W|1M|3M|1Y`, GET and HEAD only, requires the same Cloudflare Access identity and `ALLOWED_EMAIL` secret as the account endpoint.
- Alpaca query uses `timeframe=1D` and `period=1W`, `1M`, `3M`, or `1A` respectively. Values are sanitized to timestamp, equity, profit/loss and percentage only, with a maximum of 400 observations.
- **No fabricated history**: when Alpaca has no eligible observations or only one day, the chart explains this. A disconnected public GitHub Pages visitor sees a private-dashboard prompt, not simulated brokerage data.
- The browser simulator is unchanged and cannot place orders in Alpaca.
- **Interpretation**: Alpaca's P/L is relative to the selected period's portfolio-history baseline; it is not necessarily realized profit/loss, and deposits, withdrawals or changes in basis can affect interpretation.
- If the chart says history is unavailable, make sure the new GitHub deployment finished, sign in to Cloudflare Access, and (privately) inspect `/api/alpaca/history?range=1M`. Never share keys, account numbers, or detailed private positions.

## Alpaca PAPER trade history (first incremental upgrade)

LeviOS now includes a separate **Trade History** tab in the protected trading dashboard, displaying *actual Alpaca PAPER execution fills* through the read-only trading API. It never sends orders and never mixes broker fills with the browser-only "Paper Trades" simulation.

- Backend route: `GET /api/alpaca/fills` (up to 50 fills), optional `?page_token=...` for older pages. Authenticated Cloudflare Access + `ALLOWED_EMAIL` are mandatory.
- Source: Alpaca's `GET /v2/account/activities/FILL?direction=desc&page_size=50` with cursor pagination.
- The UI shows execution time (Eastern), symbol, buy/sell side, quantity, fill price, approximate execution notional, and whether an execution is a partial fill. Includes refresh and "Load older fills".
- Backend forwards *only* sanitized fields; it does not return private account numbers, order IDs, or raw broker response objects. A pagination cursor is returned for account-authorized requests only. Maximum 500 fills in the browser to avoid excessive memory use.
- No fabricated history. An empty response displays "No fills found" instead of showing simulated trades. The public GitHub Pages site shows a shortcut to the protected dashboard instead of attempting cross-site private API requests.
- Executions are not the same as realized P/L, position-level cost basis, order status, or real-time market quotes; those require separate features and correct accounting.
- Browser simulator remains separate and functional.

**Next idea (not built yet):** Add a clearly labeled real-time IEX stock watchlist, using Alpaca's available market-data entitlement. The free IEX feed is not the consolidated US-market SIP feed. Do not infer full-market coverage or unlimited quote access from the existence of GitHub trading repositories.

Reference examples: [OpenBB](https://github.com/openbq-org/OpenBB) for data exploration, [QuantStats](https://github.com/ranaroussi/quantstats) for risk analytics, and [Freqtrade](https://github.com/freqtrade/freqtrade) for trading-strategy evaluation. We borrow concepts rather than adding those projects as dependencies.

## IEX market watchlist (second incremental upgrade)

The dashboard now has a **separate IEX Watchlist** tab for up to 12 U.S. stock or ETF symbols, with a starter list of SPY, QQQ, AAPL, MSFT and NVDA.

- API: `GET /api/market/watchlist?symbols=SPY,QQQ`. This endpoint is read-only, authenticates via Cloudflare Access and `ALLOWED_EMAIL`, validates 1–12 unique tickers, and uses a single request to `https://data.alpaca.markets/v2/stocks/snapshots?symbols=...&feed=iex`.
- **No extra API subscription required** if the user's existing Alpaca credentials retain the normal free IEX market-data entitlement. If data isn't available or a plan restriction changes, the UI shows an error rather than claiming success.
- Each row shows the **last IEX trade**, bid, ask, previous-session comparison if available, the **trade timestamp**, and the **quote timestamp**. Missing snapshots stay missing, not invented. Older times are labeled as potentially stale.
- The page **polls once per 60 seconds** only while the watchlist tab is visible. It is *not* a WebSocket tick-by-tick feed. Use the Refresh button to request another snapshot; each refresh batches the whole watchlist into one API call.
- Watchlist symbol choices are saved in that browser's localStorage only; the public GitHub Pages origin and the protected Worker origin do **not** automatically sync their lists between computers. Account data and Alpaca keys are never stored in browser localStorage.
- The public GitHub Pages version provides a private-dashboard link rather than making an unauthenticated call to Alpaca.
- **IEX is one exchange and does not provide consolidated SIP market coverage**. Daily bars and latest trade timestamps may differ in scope; the change figure is explicitly the last reported IEX trade versus Alpaca's prior daily closing bar, not guaranteed executable P/L. Last trade/quote timestamps must be inspected before acting on any figure.
- This is research/paper-trading functionality, not a market order interface, and does not modify paper positions or perform real-money trading.

### Frankenstein build: inspiration, not bundled dependencies

- [OpenBB](https://github.com/openbq-org/OpenBB): research dashboards and modular provider/data exploration. We borrow the *separation of feeds from views*, not its large Python backend.
- [QuantStats](https://github.com/ranaroussi/quantstats): ideas for the forthcoming risk and performance scorecard (returns, drawdowns, benchmark comparison), but only after metric methodology is verified.
- [Freqtrade](https://github.com/freqtrade/freqtrade): strategy research, backtesting and operational safety concepts; don't import its trading execution engine into our intentionally read-only Worker.
- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts): promising future option if the charting experience justifies a dependency; keep the existing compact SVG charts for now to minimize cost and complexity.

Source: [Alpaca multiple stock snapshots](https://docs.alpaca.markets/us/reference/stocksnapshots-1) and [Alpaca market-data FAQ](https://docs.alpaca.markets/us/docs/market-data-faq).

## Alpaca PAPER performance scorecard (third incremental upgrade)

The Overview now includes a **Performance Scorecard** beneath the 1W/1M/3M/1Y P/L chart. It reuses the same authenticated `/api/alpaca/history` response and does not add Alpaca HTTP calls.

- `levios-trading/worker/src/performance.mjs` contains a pure, independently tested equity-scorecard function; Cloudflare's JS Worker imports it directly.
- Fields: max observed percentage drawdown from a previous daily equity high, dollar loss from the **same** maximum-percentage drawdown event, highest observed daily equity, lowest observed daily equity and observation count.
- One or zero observations → drawdown is **unavailable** rather than falsely 0%. A complete flat or ascending history of at least two observations correctly reports 0%.
- **Important accounting limitation:** this is drawdown on the *raw account equity series*. Deposits, withdrawals and transfers can distort it; no claim of cash-flow-adjusted investment performance, realized P/L, strategy Sharpe, win rate or profit factor is made. This is educational PAPER-account analytics.
- There is no second Python server or OpenBB runtime; the account credentials remain in Cloudflare secrets and every portfolio-history request is protected by Access.

### OpenBB decision: deliberate integration point, not a ban

OpenBB Python V5 supports **modular provider packages**, a Python interface, FastAPI endpoints and MCP integration. It can be extremely useful for multi-provider research, fundamental screening and economic datasets, but it is a separate Python-based ecosystem from the existing lightweight JavaScript Worker. Installing the *whole* OpenBB platform simply to calculate an equity drawdown and show Alpaca IEX quotes would add unnecessary deployment dependencies without supplying new licensed market-data rights. OpenBB doesn't inherently make a project slow or expensive, and using it would **not** stop GitHub editing.

**Future integration when justified:** add an optional secured `/api/research/*` adapter to a selectively installed OpenBB provider service (or a compatible Cloudflare-managed Python runtime if its dependencies prove supported) for fundamentals, macro data or cross-provider research. Keep Alpaca keys isolated, examine provider API key/licensing costs, and deploy behind Cloudflare Access; do not expose a generic OpenBB API publicly.

References: [OpenBB V5 architecture](https://docs.openbb.co/odp/python/concepts/architecture), [Cloudflare Python Workers packages](https://developers.cloudflare.com/workers/languages/python/packages/).

## Risk Dashboard (fourth incremental upgrade)

The authenticated Overview now includes **Exposure & Concentration** for the actual Alpaca PAPER positions:

- Gross open-position exposure (sum of absolute reported position values) and exposure as a percentage of current account equity.
- Long exposure versus short exposure, with a visual proportional bar.
- Largest open holding, its share of gross exposure, and top-three concentration.
- Open-position **unrealized** P/L; it is not realized trading profit or a statement of cash gain.
- No positions → zero exposure and no largest holding. Missing values → a warning and unavailable results, never an understated total. Positions from the broker response are analyzed in full, even if the holdings table displays a capped list.
- **Not computed:** broker margin debt, options Greeks, liquidity, correlation, Value at Risk, risk-adjusted performance, or externally held positions. Gross exposure divided by equity is not a margin-account risk calculation.

### Actual open-source component integrated

This upgrade **vendors the Kahan–Babuška compensated-summation implementation** from [simple-statistics](https://github.com/simple-statistics/simple-statistics) at `levios-trading/worker/src/vendor/simple-statistics/sum.mjs` with its original **ISC license** in the adjacent `LICENSE` file. The risk module imports and uses the actual implementation for exposure and P/L aggregation; this is not merely inspiration from another repo.

- Runtime: pure JavaScript within our existing Cloudflare Worker, no new Python server.
- Other modules still borrow *methods* from QuantStats and design concepts from OpenBB/Freqtrade rather than running those programs.
- The vendor boundary keeps provenance and copyright explicit, and lets us review and replace the utility independently.

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
