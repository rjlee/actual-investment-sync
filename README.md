# actual-investment-sync

An application to regularly sync stock portfolio values to Actual Budget accounts.

## Features

- Fetch stock prices via multiple providers including AlphaVantage API (`ALPHAVANTAGE_API_KEY`), Finnhub.io API (`FINNHUB_API_KEY`), or TwelveData API (`TWELVEDATA_API_KEY`).
- Sync portfolio value changes to corresponding Actual Budget accounts via transactions.
- Web UI to map stocks and portfolios to Actual Budget accounts and trigger sync manually.
- Cron-based daemon mode for automated syncing.

## Quick Start

_Before you begin, please review the [Security Considerations](#security-considerations) section below._

1. Copy `.env.example` to `.env` and fill in your Actual Budget settings (`ACTUAL_SERVER_URL`, `ACTUAL_PASSWORD`, `ACTUAL_SYNC_ID`, and `ACTUAL_BUDGET_ENCRYPTION_PASSWORD` if your budget file is encrypted).
2. Copy `config.example.yaml` to `config.yaml` if you need to override defaults (e.g. `SYNC_CRON`, `SYNC_CRON_TIMEZONE`, `HTTP_PORT`, `DATA_DIR`, `BUDGET_DIR`).
3. Build and run with Docker Compose:
   ```bash
   docker-compose up --build -d
   ```
   _or_ run locally:
   ```bash
   npm install
   npm run daemon -- --ui [--verbose]
   ```
4. Open your browser to <http://localhost:3000> (or your configured `HTTP_PORT`), define your stocks and portfolios, map them to Actual Budget accounts, and click **Sync Now**.

# Security Considerations

> **Web UI security:** The Web UI displays your stock portfolios and Actual Budget account names in your browser.

- **Session-based UI authentication** (enabled by default): requires a signed session cookie (`cookie-session` with `SESSION_SECRET`). To disable the login form (open access), set `UI_AUTH_ENABLED=false`.
- **Budget file password**: Protect your `ACTUAL_PASSWORD` (and session secret) and configure appropriate filesystem permissions to keep your budget file and mappings secure.
- **TLS/HTTPS:** to serve the UI over HTTPS (strongly recommended in production), set:
  ```bash
  SSL_KEY=/path/to/privkey.pem    # path to SSL private key
  SSL_CERT=/path/to/fullchain.pem # path to SSL certificate chain
  ```
- **Disable Web UI:** once configuration is complete, you can turn off the Web UI entirely:
  - **Locally:** omit the `--ui` flag and remove any `HTTP_PORT` setting from your `config.yaml` or `.env`, or use one-shot sync (`npm run sync`).
  - **Docker Compose:** remove or comment out the `ports:` mapping or web service definition in `docker-compose.yml`.

## Configuration

See `.env.example` and `config.example.yaml` for available options.

### Sync scheduling defaults

By default, portfolio sync runs once every hour on the hour. You can override these settings in `config.yaml` or via environment variables:

| Variable             | Default      | Description                       |
| -------------------- | ------------ | --------------------------------- |
| `SYNC_CRON`          | `45 * * * *` | Cron expression for periodic sync |
| `SYNC_CRON_TIMEZONE` | `UTC`        | Time zone for the cron schedule   |

## Releases & Docker

We use GitHub Actions + semantic-release to automate version bumps, changelogs, and GitHub releases. Docker images are built via a reusable matrix workflow:

- **CI**: runs on pushes and PRs to `main` (lint, format-check, tests).
- **Release**: runs after CI succeeds (or manually). Uses semantic-release to publish a GitHub release when conventional commits indicate a new version.
- **Docker build**: runs after Release and nightly at 23:00 UTC. Publishes API‑versioned images.

## GitHub Actions

This project includes workflows for CI, release, and Docker publishing in `.github/workflows`.

## Development

We use ESLint, Prettier, Husky (Git hooks), lint-staged, and Jest to enforce code quality.

Install dependencies and enable Git hooks:

```bash
npm install
# Husky installs hooks defined in package.json (pre-commit, pre-push)
npm run prepare
```

Lint and format checks:

```bash
npm run lint           # run ESLint and EJS template linting
npm run lint:ejs       # check EJS templates for syntax errors
npm run format         # auto-format code with Prettier
npm run format:check   # verify code is formatted
```

Testing:

```bash
npm test               # run unit tests with Jest
```

Husky hooks:

- **pre-commit**: auto-fix staged files with ESLint & Prettier (via lint-staged)
- **pre-push**: run `npm run lint && npm test` before pushing commits

Release process:

```bash
npm run prerelease     # lint, format-check, and test before releasing
npm run release        # create a new release with semantic-release
```

> **Disclaimer:** Users run this software at their own risk; no warranties are provided, and the authors are not liable for any data loss or unintended side effects.

## Docker

- Pull latest image: `docker pull ghcr.io/rjlee/actual-investment-sync:latest`
- Run with env file:
  - Pinned example: `docker run --rm --env-file .env ghcr.io/rjlee/actual-investment-sync:25.11.0`
  - Latest example: `docker run --rm --env-file .env ghcr.io/rjlee/actual-investment-sync:latest`
- Persist data by mounting `./data` to `/app/data`
- Or via compose: `docker-compose up -d`

Important: choose a tag that matches your Actual server's `@actual-app/api` version.

## Release Strategy

- **App releases (semantic‑release):**
  - Manage versioning and changelog in this repo (no separate Docker tags for app versions).
- **API matrix images (compatibility):**
  - Scope: latest patch of the last three stable `@actual-app/api` majors.
  - Tags per image: `api-<major>` for each supported major; `latest` points to the highest major.
  - Purpose: let you match your Actual server’s API line without changing your app version.

## Choosing an Image Tag

- **You know your server’s API major (recommended):**
  - Use the major alias: `api-<MAJOR>` (e.g. `api-25`).
  - Pull example: `docker pull ghcr.io/rjlee/actual-investment-sync:api-25`
  - This keeps you on the newest compatible patch for that major.
- **You want to track the newest supported major:**
  - Use `latest`.

### Tips

- You can list available tags via the GHCR UI under “Packages” for this repo
- If you run a self‑hosted Actual server, choose the image whose API major matches your server’s API line

### Compose Defaults

- Use `ACTUAL_IMAGE_TAG` to pin a semver tag (e.g., `25.11.0`) or leave unset for `latest`.
