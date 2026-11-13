# LeviOS Outreach · v0.1

A working, **browser-local and encrypted** outreach command-center prototype. It is a single-page static app suitable for GitHub Pages preview without cloud infrastructure or third-party API keys.

## Features implemented

- A modern responsive dashboard with real record-derived metrics (no fabricated demo data)
- Business, career, networking, and collaboration opportunities
- Create, edit, delete, search, and filter records
- Kanban pipeline with distinct outreach stages
- Draft messaging, subject lines, researched angles, optional concept URLs
- **Copy & Open**: copy a draft and open Gmail compose or a verified social profile
- **Explicit sent confirmation**: opening a page/copying text never counts as a send
- Record a reply and automatically cancel the outstanding follow-up
- Reschedule follow-ups five business days at a time
- Chronological activity history and limited actual-outcome analytics
- Browser-local AES-256-GCM encryption using a PBKDF2-SHA256 derived key
- Password is never stored; key remains only in memory; idle auto-lock after 20 minutes
- Encrypted JSON backup/restore; unencrypted CSV export (with warning); CSV/JSON import with validation and duplicate checks

## Run locally

Serve the folder with an HTTP server (necessary for Web Crypto on supported secure origins):

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Then visit http://127.0.0.1:8080 . The application has no compilation step and does not require npm.

## GitHub Pages preview

The static files can be placed in a folder, e.g. `/levios-outreach/`, within `LeviMunk/levimunk.github.io` and become accessible at `https://levimunk.com/levios-outreach/` once Pages deploys. This does not change DNS, CNAME, or existing portfolio files.

**Security limitation:** anyone can download the publicly hosted *application code*, but no private records are part of that code. All entered data is encrypted in browser storage. Because the app is a static public site, this is **not a remote authenticated, cross-device production CRM**; it does not authenticate access to a cloud database. Use a dedicated server-side auth and storage provider before adding cloud synchronization or Gmail credentials.

## Vault and backups

- Use a long, unique passphrase (12 characters minimum). You need it each time you unlock the app.
- Data stays on the browser/device where created. It is **not synchronized** to other devices.
- Download encrypted backups after significant changes. Clearing browser data, changing profiles or losing the device without a backup loses your data.
- An encrypted backup can be imported on another device, then unlocked with the original passphrase. This **replaces**, not merges, the local vault.
- CSV export is intentionally marked as unencrypted. Protect exported CSV files appropriately.
- A strong passphrase mitigates offline guessing; a compromised browser, malicious extension, or injected script could still read decrypted data while the app is unlocked.
- The app currently imports JSON prospect arrays and simple CSVs. No background sync, verified Gmail integration, or AI backend exists yet.

## Subsequent milestones

1. Choose Supabase Auth + PostgreSQL with row-level security **or** Cloudflare Access + Workers + D1 after evaluating actual setup and ongoing costs. Do not combine competing datastores.
2. Move records to private server-side storage with authentication and encrypted token handling. Add migrations and server-side authorization tests.
3. Implement Gmail OAuth, draft creation, sent/reply thread sync, follow-up suppression, and consented notifications.
4. Implement a schema-validated AI ingestion endpoint, with human approval, idempotency, and source attribution.
5. Add import adapters to `LeviMunk/levios-career`, preserving its source and any real existing data. Its current README specifies no authentication, so do not expose it to the internet.
6. Add automated tests beyond the static smoke checks and support safe deployments.

## Data model (prototype)

Each record has `id`, `name`, `type`, `industry`, `location`, `person`, `channel`, `email`, `profile`, `website`, `stage`, `followup`, `concept`, `angle`, `subject`, `draft`, `notes`, `createdAt`, and `updatedAt`. Activities have `id`, `recordId`, `kind`, `summary`, `snapshot`, and `at`.

The next phase should normalize organizations, contacts, opportunities, messages, conversations, tasks, and provenance into a database instead of treating this browser-local structure as a permanent schema.

## Licensing

This initial code is intended for the repository owner. Keep the new code and any credentials separate; it uses no external source-code libraries or paid APIs.