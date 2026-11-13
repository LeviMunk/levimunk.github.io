# LeviOS Trading — Project Status

**Updated:** 2026-11-12
**Canonical code:** `LeviMunk/levimunk.github.io`
**Production branch:** `main` (do not edit directly for feature development)
**Protected trading dashboard:** `https://levimunk-alpaca.levivanstap.workers.dev/`
**Public portfolio:** `https://levimunk.com/` (GitHub Pages; domain/DNS remain unchanged)

## Purpose
A read-only Alpaca PAPER market-data dashboard and personal trading-education/research lab. Explain observations, question hypotheses, and measure simulated strategies. It does **not** place Alpaca orders or make live-trading decisions.

## Architecture
- `levios-trading/index.html`, `styles.css`, `app.js`: shared static interface on GitHub Pages and the protected Worker.
- `levios-trading/{strategy-engine,validation-engine,coach-engine,radar-engine}.js`: client-side deterministic, separately testable research modules.
- `levios-trading/worker/build.mjs` and root `build.mjs`: package the same frontend into Cloudflare Worker assets.
- `levios-trading/worker/src/index.mjs`: Cloudflare Access-protected, GET/HEAD-only server; `ALLOWED_EMAIL` defense-in-depth; Alpaca paper secrets live only in Worker secrets.
- Existing paper endpoints: account status/history, fills, risk and IEX snapshots/bars. IEX is single-exchange, not consolidated SIP.
- Browser `localStorage`: practice trades, watchlist choices, research experiments/approvals. These do **not** sync across devices and are not a tamper-proof audit log.
- TradingView Lightweight Charts is self-hosted via the pinned dependency.
- Main test workflows: `.github/workflows/check-levios-trading.yml`, `check-levios-worker.yml`, `mobile-browser.yml`; GitHub Pages deployment workflow also runs.

## Implemented and tested
- Alpaca PAPER account P/L and history, performance scorecard, read-only trade history
- IEX watchlist/snapshots/candlesticks and account risk overview
- Simulated trades, moving-average strategy testing, cost stress checks, research validation gates
- Three-window robustness and expanding-window walk-forward research
- Trading Coach educational interpretations from completed IEX candles
- On-demand watchlist Market Radar for unusual IEX-only price, volume and range movements
- Official-source Market Events Intelligence with automatically fetched BLS ICS and BEA JSON on protected calendar visits (6-hour per-browser refresh), per-source failure fallback, and Federal Reserve dated snapshot
- Previous reference good build: `45f816c` (frontend, Worker tests, mobile and Pages all passed). This does not independently prove the private Cloudflare deployment.

## Security invariants
1. NEVER commit Alpaca credentials, account identifiers, access tokens or personal brokerage data. No real-money keys.
2. Cloudflare Access authentication **and** matching `ALLOWED_EMAIL` are required for account data and private assets. No public CORS.
3. Brokerage API remains read-only. No order endpoints, order submission, automation to trade or AI strategy execution.
4. Keep Bluehost domain + GitHub Pages, private workers.dev hosting and existing Cloudflare secrets unchanged.
5. No fabricated prices or silently inferred unavailable financial data. Show source, coverage, timestamps and caveats.

## Current work / roadmap
1. **Market Events Intelligence v2**: BLS and BEA agency feeds checked automatically on opening the authenticated calendar with a six-hour browser cache and independent source-status/fallback. FOMC remains a dated snapshot; not continuous unattended polling or earnings data.
2. Further research: verified company earnings dates (requires reliable provider and entitlement review), news context with attribution, then a structured hypothesis/trading journal.
3. Optional recurring checks/notifications only after a separately approved operational design; the browser's on-demand radar is NOT always-on.

## Development procedure
1. Read this file first in new ChatGPT sessions. Inspect only the required files.
2. Create a `feature/*` branch from latest `main`; never commit in-progress work to production.
3. Implement feature + tests + documentation on that branch. Keep changes reviewable. Prefer batching related edits over many tiny production commits.
4. Open a PR. Verify frontend, Worker/API security, tests and mobile checks on the **latest head SHA**. Resolve failures on branch.
5. Squash-merge **only after green checks** and verify deployment on `main`. If a protected live Cloudflare environment cannot be tested, explicitly mark that as unverified.
6. If tests or safety checks fail, do not merge. Update this document when feature scope or architecture changes.

## Known limitations
- IEX coverage is limited to one exchange. Historical raw bars may not reflect dividends/splits or consolidated volume.
- Backtests simulate next-close fills and have multiple modeling/bias limitations; repeated holdout inspection compromises rigor.
- Market Radar runs manually, not continuously. Market Events refreshes BLS/BEA agency feeds on authenticated calendar opening but not unattended in the background; Federal Reserve still uses a dated snapshot. No company earnings feed, general news feed or push alerting yet.
- Browser research logs are local-only. Cloudflare deployment status must be checked separately from GitHub Pages.

## Fast checks
- `node build.mjs` at repo root (requires Node/npm).
- `node --check levios-trading/app.js`
- `node --test levios-trading/worker/test/*.test.mjs`
- GitHub Actions for deployment/test results; investigate failure logs before touching production.

## How to resume in a new chat
“Inspect `PROJECT_STATUS.md` in `LeviMunk/levimunk.github.io`, check the latest PR and CI, and continue the next LeviOS Trading change using feature branches. Do not modify order permissions, domain/DNS or Worker secrets.”
