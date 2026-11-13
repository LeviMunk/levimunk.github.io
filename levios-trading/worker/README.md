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

## Real TradingView Lightweight Charts integration (fifth incremental upgrade)

LeviOS now **installs and bundles the actual open-source [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) library** (pinned to `lightweight-charts@5.2.1`) rather than only borrowing its design ideas.

**Build/runtime architecture**
- Repository root `package.json` pins the upstream package. Running the unchanged Cloudflare build command `node build.mjs` builds the UI and reads the installed standalone browser bundle; the build installs the pinned package only if node_modules is absent.
- The build includes the standalone production browser library in the Worker-generated static assets. Private `GET /lightweight-charts.js` serves that bundle on the same origin as the dashboard, behind **Cloudflare Access** and the owner email allowlist. No CDN script, cross-origin brokerage response, or browser API key is required.
- The public GitHub Pages edition remains the browser simulator and keeps its original static SVG graphs. The authenticated Cloudflare edition upgrades the **Alpaca PAPER P/L history** to a TradingView `AreaSeries`, with the existing SVG as a fallback.
- The IEX Watchlist now offers a separate **TradingView `CandlestickSeries`** with ticker selection, 1M/3M/1Y ranges, crosshair, drag-to-pan and zoom. It retrieves real daily OHLC bars via `GET /api/market/bars?symbol=SPY&range=3M`; the Worker fetches `/v2/stocks/{symbol}/bars` from Alpaca with explicit `feed=iex` and `timeframe=1Day`. Maximum 400 bars; unexpected/invalid bars are discarded.
- The chart shows missing-data and error states, never fabricated candles. IEX is **one exchange**, not consolidated SIP prices, and historical daily candles are **not tick-by-tick streaming quotes**. The existing IEX snapshots continue to refresh separately while the watchlist is visible.
- This is a read-only dashboard; no automatic order placement or autonomous strategy rewriting has been added.

**License and attribution**
- TradingView Lightweight Charts is Apache-2.0 licensed. The upstream `NOTICE` and full Apache license are preserved as `levios-trading/worker/licenses/TRADINGVIEW_NOTICE.txt` and `TRADINGVIEW_APACHE_LICENSE.txt`.
- Visible attribution and a link to [TradingView](https://www.tradingview.com/) are included in the dashboard footer and beneath the candlestick panel.
- [Official v5 integration guide](https://tradingview.github.io/lightweight-charts/docs) documents `createChart`, `addSeries`, series updates and standalone builds.

**Future research/bot concept:** The diagram shared in this conversation is an architectural *proposal*, not evidence of a profitable self-improving bot. Research, backtesting, out-of-sample testing and paper monitoring can be added as **separately audited modules**. Automated order submission remains disabled and is not required for data/charting improvements.

## Strategy Testing Workbench (sixth incremental upgrade)

The previous single-result moving-average demo is now a **reproducible research workbench** using the standalone `levios-trading/strategy-engine.js` module. The same module runs on public GitHub Pages or the Cloudflare Access-protected Worker, without API credentials or extra infrastructure.

**Data sources**
- Uploaded `date,close` CSV prices (existing Market Data import); the explicitly labeled **FICTIONAL DEMO** series is also supported.
- Optional real `Alpaca IEX` daily closing bars, fetched read-only through the already protected `/api/market/bars?symbol=...&range=1Y` endpoint. Excludes today's unfinished New York market-date bar. It never pulls or alters broker positions. Bars are IEX-only, **not consolidated SIP**, and raw data may be unadjusted for splits and dividends. If the year is truncated or too short, research execution is stopped.

**Execution and validation rules**
- Fixed, long-only fast/slow SMA. Parameter range `2 ≤ fast < slow ≤ 250`. Signals form after a completed daily close, and an order fills at the **following recorded day's close**. This is a simplified execution assumption; real close fills and spreads aren't guaranteed. No future prices are used to generate signals.
- Fee and adverse slippage can be specified independently at `0–200 basis points` each per execution. Same initial assumed fee/slippage is charged to buy-and-hold for a fair baseline. No taxes, dividends, market impact, liquidity model or corporate-action adjustment.
- Chronological split of 50–85% earlier data and a later evaluation window. Moving-average positions carry across the split. Test return begins from the previous day's equity baseline so prior training-period profits are not counted as evaluation returns.
- **This is not automatically an unbiased holdout once viewed.** Re-running different parameter combinations after checking the later dates destroys the strict blind-test assumption. Promotion to a live strategy is NOT implemented.
- Freqtrade's look-ahead-bias guidance inspired prefix-invariance and next-bar-execution tests, without installing or copying its trading bot. See [Freqtrade lookahead analysis](https://www.freqtrade.io/en/latest/lookahead-analysis/).

**Research versioning**
- Save a run manually as v1, v2, etc., including parameters, train/evaluation results, relative buy-and-hold, date coverage, engine version, data source and an **8-character non-cryptographic FNV-1a fingerprint** for reproducibility.
- Retain the newest 25 experiments in browser localStorage, with a one-click JSON export. This is **per browser**, not an account-synced experiment database; it contains no Alpaca keys.
- The experiment log does not deploy code or trade automatically. Proposed strategy improvements still require out-of-sample verification and explicit review.

**Automated tests**
- `levios-trading/worker/test/strategy.test.mjs` checks repeatability, no forward data leakage when extending a historical series, next-close execution delay, fee and slippage effects, split boundaries, missing data and invalid parameters.
- `levios-trading/worker/test/safety.test.mjs` verifies the shared engine is hosted behind Cloudflare Access.
- GitHub Actions runs both tests in the existing build workflow.

## Strategy Validation & Promotion Gates (seventh incremental upgrade)

A separate **Validation & Promotion** section now follows the Strategy Lab's Saved Experiment Versions. It is intended to prevent the research process from automatically accepting appealing backtest results. **Nothing is connected to an order API or actual strategy deployment.** An approval is a browser-local designation of a *research champion*, not a paper-trading activation or permission for an AI to trade.

### How it works

1. Run the Strategy Workbench using actual IEX history or dated CSV data, then **Save this run as version**. The saved version now includes evaluation observations and executions, plus a stress-test rerun with fees and slippage at least doubled (minimum 5 bps each). This uses the **same frozen price dataset and same split dates** as the original run.
2. Select a saved version in **Validation & Promotion** and click **Run validation gates**. Fixed deterministic rules return a pass/fail with individual rejection explanations. A saved version created before these fields existed is rejected as incomplete; **rerun and save** rather than inventing a stress-test result. Fictional DEMO data may be explored but never approved.
3. Default v1 policy, hard-coded and versioned in `levios-trading/validation-engine.js`:
   - At least **30 evaluation observations** and **2 simulated evaluation-period executions**;
   - Evaluation return at least **1.0 percentage point above buy-and-hold** over the same later dates, using the same initial cost assumptions;
   - Evaluation maximum drawdown no worse than **−15%**;
   - The higher-cost stress rerun must still **meet or beat its own buy-and-hold benchmark**;
   - If an existing research champion shares the **same ticker, source, engine, data fingerprint, date coverage, split date and cost settings**, the candidate must improve evaluation return by **at least 0.5 percentage points** while worsening drawdown by **no more than 2 percentage points**.
4. A passing review only enables a separate **Approve research champion** button. It requires an explicit confirmation and rechecks the latest champion first. Failed checks cannot be overridden with this button.
5. Each review (including rejection) and explicit research approval is saved in an append-only-in-use browser-local decision log, up to 100 events, with the latest 30 displayed. Approvals contain a copy of the candidate's metrics so a previous champion can still be evaluated even if older experiment runs have rolled out of the saved 25-item table. **Export research log** now includes both experiment versions and validation decisions in one JSON file.

### Limitations and safeguards

- Decisions are kept in this browser's `localStorage`; users can edit or delete them. This is **not an immutable audit or independently verified research record**, and versions do not sync across devices. The data hash is a non-cryptographic FNV-1a fingerprint, not integrity attestation.
- Repeatedly testing different candidates against the same later dates **contaminates the holdout**. None of these fixed thresholds guarantees a profitable strategy. Independent forward/walk-forward validation and rigorous cost models are still needed.
- Backtest fills are **hypothetical next-close executions**. IEX prices are single-exchange and may be unadjusted for corporate actions or dividends. There is no survivorship-bias, liquidity, spread, queue, or tax simulation.
- The new JS is bundled from the **same GitHub code into the Cloudflare Access-protected Worker**; both GitHub Pages and private dashboards share the rule engine. All private Alpaca APIs remain read-only. No webhook, trading key exposure, approval-to-deployment action, or AI-generated automatic strategy rewrite was added.

### Tests

`levios-trading/worker/test/validation.test.mjs` checks successful and rejected gates, missing data, fictional prices, stress costs, mismatched baselines, champion improvement, and approval selection. The existing `safety.test.mjs` verifies the validation module is served only after Cloudflare Access. CI runs all strategy, validation, and account safety suites.

## Three-window strategy consistency diagnostic (eighth incremental upgrade)

The Strategy Testing Workbench now reports three sequential, non-overlapping subperiods **inside the existing evaluation period** for each completed backtest, with start/end dates, observation count, strategy return, same-window buy-and-hold, excess return (percentage points), maximum observed drawdown, and hypothetical execution count. The first window starts on the existing evaluation split date. Returns use the preceding day's equity as their baseline, so no price changes are double-counted at boundaries.

The view is deliberately **diagnostic, not walk-forward retraining**: the same parameter set was chosen for the original backtest and no independent future observations are introduced. Three windows do not constitute three blind tests. The component reads in-memory backtest results and makes no additional network or Alpaca requests. If fewer than 30 evaluation bars exist, it displays an insufficient-history state rather than inventing results. Regression coverage lives in `levios-trading/worker/test/strategy.test.mjs`.

## Expanding walk-forward research (ninth incremental upgrade)

The Strategy Testing Workbench contains **Run walk-forward test**. It reuses the currently selected historical CSV or authenticated Alpaca IEX daily closes and existing fee/slippage assumptions. The deterministic research-only evaluator requires at least 150 completed daily observations and reports three consecutive evaluation folds, following an initial 50% training period.

For each fold, the engine independently runs three long-only moving-average parameter pairs (5/20, 10/30, 20/50) **using only the expanding training prefix**, selects the best training-period strategy excess return over the same-cost buy-and-hold baseline, then evaluates that selected parameter pair on the immediately following held-out dates. Training selection never reads future data. The fold reports selected moving averages, training cutoff, evaluation dates, strategy and buy-and-hold returns, percentage-point excess, maximum drawdown and hypothetical executions. The three evaluation windows never overlap.

**Not continuous execution:** each fold's calculation uses its own simulated equity path from dataset inception to establish indicators and the position held at that fold boundary. Fold returns must not be added or interpreted as a stitched, executable account equity curve. The backtest uses hypothetical next-close fills and excludes important execution friction, splits, dividends and survivorship biases. Repeatedly altering research choices after seeing these same dates contaminates any out-of-sample claim; true prospective paper validation is still required. No broker orders, new credentials, extra network requests or paid services.

## Trading Coach: contextual IEX education (tenth incremental upgrade)

The protected IEX Watchlist now includes **Trading Coach** below its existing candlestick chart. It interprets actual *completed* IEX daily bars already fetched for the selected chart ticker: last close versus the 20-day average, optional 20-versus-50-day average, position inside the recent 20-session high/low range, and annualized close-to-close volatility calculated from the last 20 log returns. Each observation has an explanation of what the statistic does and does not mean and a question for the user to investigate.

The browser excludes the unfinished current New York session from coach analysis. It displays explicit insufficient-data and invalid-candle states, makes no extra Alpaca requests, and never invents prices, automated trade signals, trading orders or predictions. IEX-only prices do not represent the entire consolidated market and may differ from SIP bars. The coach provides educational observations **only when the chart is loaded**: there is no 24/7 monitoring, push notification, economic calendar, earnings/news analysis, or AI-generated natural-language interpretation yet.

The independent `coach-engine.js` is bundled into the Worker through `build.mjs`, served by the same Cloudflare Access authentication gate as other dashboard assets, and regression-tested in `worker/test/coach.test.mjs`.

## On-demand Market Radar (eleventh incremental upgrade)

The IEX Watchlist now offers **Scan watchlist** for up to twelve tracked stock/ETF tickers. Scans use the existing authenticated `GET /api/market/bars?symbol=...&range=3M` endpoint, with at most two requests in flight. No new API credentials or paid data provider are required. Only historical bars dated before today's New York market date are evaluated; an unfinished session never becomes a completed radar observation. The radar discards truncated responses and reports unavailable data rather than silently inferring values.

The deterministic `radar-engine.js` examines: (1) a completed-session price change of at least 2% and twice the prior 20-comparison average absolute daily move; (2) positive IEX venue volume at least 2× the average of 15 or more valid earlier sessions, if volume is available; (3) a last close above the prior twenty-session high or below the prior twenty-session low. It displays exact evidence, the methodological limitation, and a question to research for every observation. A zero-finding result does **not** imply safety. Radar results stay in the browser's memory during the session and are not used as trading instructions.

This is **manual on-demand scanning, not 24/7 monitoring, automatic alerting, exchange-wide scanning, or a news/earnings calendar**. Alpaca's free IEX feed reflects one venue and raw historical bars; corporate actions, market-wide volume, and consolidated SIP are not available from these observations. No background automation, order routes, write operations, external telemetry, or AI price predictions are added.

## Market Events Intelligence v1 (official schedule snapshot)
The separate **Market Events** tab uses `events-engine.js`, an offline, date-stamped snapshot verified against official BLS, BEA and Federal Reserve schedules as of **2026-11-12**. Dates/times are scheduled US Eastern releases; Fed policy meeting date does not imply a specific policy release hour. Each item includes an official source, explanation and a critical research question. Expired/potentially stale schedule warnings display automatically after 14/60 days. Filters by category and upcoming 120-day window; no brokerage API calls, paid event provider or private credentials.

**Important:** This is not a live/updating economic calendar. The source can revise publication schedules or add releases after the snapshot date. No earnings calendar, automatically linked breaking news, stock-specific corporate actions, alerts, continuously monitored catalysts or demonstrated news-to-price causal linkage. Use the official calendar links before relying on any dates. Events are not predictions. Static snapshot tests are in `worker/test/events.test.mjs`.

## Market Events Intelligence v2: official feed auto-refresh
When the signed-in user opens **Market Events**, LeviOS automatically fetches `GET /api/market/events` from the same protected Cloudflare Worker. The read-only endpoint retrieves **only** the official BLS ICS feed (`https://www.bls.gov/schedule/news_release/bls.ics`) and BEA JSON (`https://apps.bea.gov/API/signup/release_dates.json`) in parallel. It uses strict allowlisted event families, source-size/timeout limits, no redirects, no user URL input, no new secrets, and independently reports each agency's availability. No public CORS or broker writes. Results are cached in browser *sessionStorage* for 6 hours, so successive page visits don't constantly request agency feeds. The Refresh button bypasses that browser cache.

**Per-agency fallback:** A successful BLS or BEA fetch replaces only that agency's stored snapshot entries in the upcoming 120-day view. If an agency fetch is unavailable or fails format validation, only that agency falls back to the original dated static schedule, explicitly labeled as snapshot. Federal Reserve dates remain snapshot-only; no live FOMC feed. BEA JSON provides the broad series name rather than the release quarter or data month, so no quarter/month is fabricated.

Cloudflare Access-protected `workers.dev` does not support the Workers Cache API; this upgrade deliberately avoids Cache API and KV/D1 binding changes. Source fetches happen when the calendar is opened (and when manually refreshed), **not when the browser is closed**. This is *not* unattended periodic monitoring or push alerts. Only upcoming BLS Employment Situation, JOLTS, CPI, PPI, BEA GDP and Personal Income/Outlays are supported. Both upstream schedules can change and must be verified at the agencies. Regression coverage: `worker/test/event-feeds.test.mjs` plus Worker safety tests.

## Company earnings intelligence (Upgrade 14)
The Market Events tab includes Earnings Intelligence for the local IEX watchlist. The independent `earnings-engine.js` has a dated, linked NVIDIA company-confirmed earnings-call announcement and issuer investor-relations links for the initial watchlist. Its confirmation refers to the event in the linked announcement; the fiscal report release time may differ from the call time. No extrapolated/guessed future earnings dates.

Optional **Alpha Vantage** estimates can supplement the dashboard after you privately set a Cloudflare Worker secret named `ALPHAVANTAGE_API_KEY`. The protected `GET /api/market/earnings?symbols=AAPL,MSFT` endpoint validates 1–12 unique watchlist tickers, requests a 3-month provider calendar once, filters to the selected tickers, validates CSV format, and labels all provider entries **provider_estimate**, never issuer_confirmed. The secret is never returned in JSON or exposed to browser JS or GitHub. Missing credentials give an explicit unavailable state, not a fabricated schedule. Free API rates/terms apply; avoid excessive refreshes. This is a manually refreshed research panel with short-lived browser cache, not unattended notifications. No changes to Alpaca, Cloudflare Access policy, DNS or hosting.

## Market Radar Catalyst Context
Market Radar now cross-references its last **completed IEX daily candle date** with official macro release schedules and issuer-confirmed or explicitly estimated same-ticker earnings dates. The deterministic `catalyst-engine.js` only displays source-labeled events on the same date, the prior three calendar days, or the following seven calendar days. It never claims an event caused a price move. Same-day events are flagged as **intraday timing unverified**; a future event is marked **upcoming and cannot explain the earlier move**. Marketwide macro events are general context, not ticker-specific causes. If no relevant events are available, it says so, rather than inventing one.

The existing six-hour agency-feed and optional earnings lookup caches are reused on radar scans to limit requests; the results appear alongside each radar ticker. The issuer snapshot is dated and Alpha Vantage entries remain estimates. No persistent news archive, issuer results matching, economic surprise data, model prediction, new data provider, broker write API or 24/7 process was added. Unit tests cover temporal boundaries, symbol matching and attribution safeguards.

## Hypothesis Journal (Upgrade 16)
Standalone `journal-engine.js` adapted to LeviOS using design ideas from [LuxAlgo/trade-journal](https://github.com/LuxAlgo/trade-journal) and Freqtrade's reproducibility safeguards. Users record a pre-outcome thesis, supporting and opposing evidence, invalidation conditions, time horizon, manual reference/invalidation prices, and hypothetical maximum loss budget. The original entry is not editable in the UI; later reviews are separate immutable objects with observed review price, evidence assessment and lesson. The hypothetical size calculation excludes fees, slippage, overnight gaps, and buying-power constraints; it does not submit orders or measure realized Alpaca P/L.

Saved locally in the browser under `levios-hypothesis-journal-v1` with a 100-entry bound, input validation, exported JSON backup, and explicit local-only warnings. Browser storage isn't cryptographically tamper-proof and doesn't sync between machines. The standalone journal engine is bundled into the protected Cloudflare Worker and tested in `worker/test/journal.test.mjs`. Other existing portfolio exports do not automatically include these entries; use the journal's dedicated Export button.

## Action-first decision support home (Upgrade 17)
Home now begins with **What should I do next?** and a one-click PAPER watchlist brief. The transparent `decision-guide.js` borrows action-prioritization ideas from FolioOrb, KaanCan1/portfolio-tracker and risk/analytics reporting concepts from QuantStats, without installing their runtimes. The briefing requires 50 valid **completed** daily IEX closes for each symbol and sorts: (1) excessive PAPER concentration above a simple 25% equity screening threshold, (2) held instruments below both 20/50 daily moving averages, (3) other held instruments, (4) unheld instruments above both averages, (5) wait/investigate. Each action states why, next research steps and what evidence could change it.

This is a deterministic educational decision aid, NOT an investment adviser, a quantified expected return or an executable buy/sell recommendation. It does not check company fundamentals/valuation, tax lots, order books, position correlations, money at risk outside the PAPER account, or a user's investor suitability. If data is unavailable, invalid or incomplete, the system abstains. No unattended checks, broker write routes, billing, new secrets or additional paid data providers. A button explicitly runs the brief using protected read-only Alpaca IEX bar requests (max two concurrent requests), with risk review prioritized. The existing deeper overview and P/L analytics remain below the simplified top panel.

## Stock Research v1 (Upgrade 18)
The Stock Research tab is an evidence-first learning aid inspired by the modular research pipeline of OpenBB and the explicit factor/valuation sections of open-source equity research screeners. It has no new market-data subscription or endpoint. Users must manually enter five numeric metrics and a public SEC or annual-report URL; the URL is an *unverified reference* supplied by the user, NOT parsed or confirmed by the software. Positive/negative checks use coarse, documented illustrative thresholds for growth, operating margin, leverage, FCF, and P/E. They are not sector-neutral, historically validated, or sufficient for valuation. The result is strictly "worth deeper research", "investigate risks", "more evidence needed", or "update financial data" and explicitly abstains from actionable stock recommendations.

No new API keys or secrets. The basic Alpha Vantage OVERVIEW endpoint is premium as of the provider's currently published documentation; FMP Basic coverage/licensing is limited. SEC's free EDGAR companyfacts is a possible future integration but requires appropriate CIK mapping, user-agent and rate-limit controls. This feature does NOT claim to automatically source or verify numbers, produce fair value/expected returns or advise real trades. Uses the same authenticated Worker asset and unit tests.

## SEC EDGAR annual financials (Upgrade 19)
The private Stock Research tab can load public annual (10-K) XBRL facts on-demand through `GET /api/research/sec-financials?symbol=TICKER`. The Worker fetches only allowlisted `www.sec.gov/files/company_tickers.json` and `data.sec.gov/api/xbrl/companyfacts/CIK##########.json`, with no user-defined upstream URLs, redirect following, CORS, paid API keys or brokerage order permissions. It requires `SEC_USER_AGENT` to be set **privately** on the Worker, with an identifiable application and working administrative contact email; the contact never appears in GitHub or browser data. SEC fair-access guidelines allow no more than 10 requests/second; this is a low-volume, manually triggered 2-request workflow with browser session caching and a single active lookup, not a crawler.

The parser requires annual 10-K reporting durations of roughly one fiscal year, same-period comparisons for operating margin and FCF, and same-year comparable revenue for growth. If current and noncurrent debt tags and shareholders' equity are present on the same report date, a **long-term debt/equity proxy** can be derived; otherwise the field remains empty. Missing XBRL concepts are null, never assumed zero. Report accession, filing date, period, concept tags and a SEC archive link are shown. The existing P/E remains manually sourced because SEC financial filings alone cannot establish a current market multiple. SEC reports can be restated and taxonomy varies across companies; industry context is still required.

SEC data is free but no live response is claimed until the Worker secret is configured and the live endpoint has been separately verified. The authenticated Worker test suite uses synthetic SEC fixtures and never contacts the agency. No new provider secrets committed to GitHub.

## Relative Valuation v1 (Upgrade 20)
The Stock Research tab now offers on-demand two-ticker relative valuation, following transparent factor and source-provenance approaches found in maintained investment analysis tools. It reuses the authenticated, rate-limited-by-user SEC annual financials and the existing read-only Alpaca IEX daily bar endpoint; no paid market feed, proxy or new key. Users select **two** tickers; the app retrieves two SEC annual reports and two recent IEX daily bars with a bounded sequential workflow.

The SEC adapter now includes annual net income and annual diluted **weighted-average** shares from same-period US-GAAP XBRL tags when available. With a recent completed IEX-only closing price (<=7 calendar days old), the client computes approximate price/sales, price/earnings and price/free-cash-flow multiples using annual per-diluted-share figures. These are approximate proxies, **not** consensus multiples, precise market cap, forward forecasts, authoritative price targets or trading signals. Missing/negative denominators yield missing ratios rather than zero or misleading cheapness. Fiscal reporting periods must be within 120 calendar days to mark an explicit peer comparison as numerically comparable. Cross-industry valuations, share-count changes, accounting policies, special charges and stock-based compensation require additional study.

No provider secret appears in the browser; market-data access remains Cloudflare Access-protected. All requests must originate in the private Worker; no user-specified external URLs. Tests cover invalid/missing inputs, stale prices, fiscal mismatch and failure to rank securities. No broker order capability was added.

## Peer candidate selection and evidence-based bull/bear thesis (Upgrade 21)
The `peer-thesis-engine.js` is a minimal standalone deterministic rules engine, using design principles from open-source peer comparison dashboards such as Sellside Research Engine and Equity Research Lab. A small built-in set of **editorial peer candidates** helps the user choose a second ticker while explicitly stating different business models. These peer suggestions are NOT live provider rankings, SEC-SIC-certified same-industry matches, or a comprehensive peer universe; an unsupported ticker gets no invented peers.

After the user runs an existing authenticated SEC and completed IEX two-ticker comparison, the same validated valuation data produces a separately labeled conditional **bull case**, **bear case**, **unknown evidence**, and **due diligence checklist**. The generated statements name their SEC-derived annual or IEX-proxy metrics and use explicit comparator values. Without comparable data the engine gives questions and unknowns, not invented evidence, targets, conviction scores, execution instructions or a buy/sell winner. No new network services, paid provider or secrets are added. Tests cover business-model distinctions, absent evidence and provenance guards.

## Action-first Decision Brief and interface cleanup (Upgrade 22)
On the Overview tab, users can enter one ticker and request a concise decision brief. Existing protected SEC companyfacts and completed Alpaca IEX daily candles are requested on demand, with independent error handling. The deterministic `decision-brief-engine.js` combines account-verified PAPER exposure, price observations, optional annual filing numbers and the latest locally saved original thesis. It reports a plain-language **next research action**, bull evidence, bear evidence, unknowns, and an explicit why/next step. It prioritizes verified concentration or invalidation concerns above entry research. It never produces a live brokerage order, price target, expected return, or personalized Buy/Sell instruction. Missing SEC data downgrades confidence; stale price data aborts assessment.

Overview copy is shorter, the large development notices are collapsed into optional disclosures, and advanced risk/scorecard/imported-data panels are hidden behind an explicit Show advanced analytics button. Core P/L and account status remain visible. All original advanced data and access controls remain available. Design research references include KaanCan1/portfolio-tracker (discipline/thesis first), idiehl/stockview (concise terminal dashboard) and lightweight local-first dashboards. No large UI dependency, credentials or new provider required. The static public GitHub Pages copy abstains from protected research.

## PAPER prediction tracking (Upgrade 23)
The Overview includes a strictly PAPER-only and local-only prediction ledger. The trader saves each long, limit-entry hypothetical prediction **before** the relevant future daily candles, including ticker, entry, stop, target, a 1–60 calendar-day entry window and risk budget. Plans are immutable in the UI. A separate Check Results action requests completed Alpaca IEX daily OHLC through the existing authenticated, read-only `/api/market/bars` route, never orders. Any completed candle on or before the plan-creation date is excluded to prevent look-ahead.

Outcomes are **win, loss, open, waiting, expired, ambiguous, awaiting_data, or unverifiable**. Ambiguous OHLC candles (such as stop and target touched in one day) never count as winners or losers. The target and stop are evaluated only after the entry candle, and opening price gaps through a stop may produce larger modeled losses than planned. These approximations are **NOT actual broker fills**. Win percentage is calculated only among resolved unambiguous simulated cases; all unresolved and never-triggered cases remain visible. Expected R is the average realized hypothetical reward/risk across resolved cases and should not be trusted as live expectancy. No transaction costs, liquidity/volume checks, corporate action adjustments, tracking of missed opportunities, benchmark returns or automated background monitoring are included. Manual JSON export helps retain research. Browser clearing deletes this local record. Plans within the first 24 hours or with insufficient IEX history cannot be scored. A meaningful historical sample and realistic costs are required before claiming an edge.

No real-money trading integration, order endpoint or auto-execution exists. The Worker remains GET/HEAD-only behind Cloudflare Access and PAPER-only.

## Level Up: two-track financial learning (Upgrade 24)
A separate Level Up tab now offers concise, deterministic lessons and interactive checks for **long-term investing** (stocks, funds, compounding, valuation) and **short-term trading** (entry/stop/target, risk sizing, backtest vs forward test, win rate vs expectancy). Answers are graded locally and completed lesson IDs are stored only in browser localStorage. Quizzes never change PAPER trades, account settings or trading recommendations. The Learning Engine has no network access; it is delivered with both the protected Worker and public read-only GitHub Pages app. Mobile browser tests exercise both tracks.

This feature intentionally does not claim that LeviOS can make money, nor does it schedule background trading. The independent research/strategy runtime, persistent server-side signal ledger, simulated execution, benchmark comparison and planned Cloudflare scheduler remain **unimplemented** and require separate architecture/deployment work. PAPER-only is an invariant; no real broker order endpoints are introduced.

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

### Three-tab command center UX
The primary navigation now has exactly three top-level user-facing views: Command Center, Trade Desk, and Academy. Existing watchlist, research, strategy, simulator, market-event, journal, fills, and settings panels remain reachable under **Advanced tools**. Command Center aggregates the existing **local hypothetical prediction ledger only**, showing counted wins/losses and an explicit not-running message for autonomous scanning/execution. It is not Alpaca account realized P/L; that stays separately labeled. Trade Desk includes a small zero-dependency completed IEX daily OHLC candle plot and a line-by-line prediction ledger, with the same honest empty state. No automated background trades or real-money orders were added. Chart data is unavailable on public GitHub Pages and fetched only from the existing protected Worker when the Trade Desk is opened. Mobile tests verify navigation, empty states, charts, and the advanced-tools disclosure.
