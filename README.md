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

We use GitHub Actions + semantic-release to automate version bumps, changelogs, GitHub releases, and Docker image publishing:

- **CI & Release** (`.github/workflows/release.yml`) runs on push to `main`: lint, format-check, test, and `semantic-release` (updates `CHANGELOG.md` and `package.json`, tags a release, and merges to the `release` branch).
- **Docker Build & Publish** (`.github/workflows/docker.yml`) runs on push to `release` (or after the CI workflow succeeds): builds the Docker image and publishes to GitHub Container Registry (`ghcr.io/<owner>/<repo>:<version>` and `:latest`).

Ensure your repository has the `GITHUB_TOKEN` secret (automatically injected) so that Semantic Release and Docker publishing can push back to GitHub.

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
  - `docker run --rm --env-file .env ghcr.io/rjlee/actual-investment-sync:latest`
- Persist data by mounting `./data` to `/app/data`
- Or via compose: `docker-compose up -d`

## API-Versioned Images

Actual Budget's server and `@actual-app/api` should be compatible. This project publishes API‑specific images so you can pick an image that matches your server:

- Exact pin: `ghcr.io/rjlee/actual-investment-sync:api-25.2.1`
- Minor alias: `ghcr.io/rjlee/actual-investment-sync:api-25.2`
- Major alias: `ghcr.io/rjlee/actual-investment-sync:api-25`

The Dockerfile accepts a build arg `ACTUAL_API_VERSION` and CI publishes images for the latest patch of the last two API majors (stable only, no nightly/rc/edge). Each build also publishes rolling aliases for the minor and major lines. Images include labels:

- `io.actual.api.version` — the `@actual-app/api` version
- `org.opencontainers.image.revision` — git SHA
- `org.opencontainers.image.version` — app version

### Examples

- Run with a specific API line: `docker run --rm --env-file .env ghcr.io/rjlee/actual-investment-sync:api-25`
- Pin exact API patch: `docker run --rm --env-file .env ghcr.io/rjlee/actual-investment-sync:api-25.2.1`

## Release Strategy

- **App releases (semantic‑release):**
  - Tags: `<app-version>`, `<major>.<minor>`, `<major>`, `latest` (e.g. `1.1.7`, `1.1`, `1`, `latest`).
  - Built from the repository’s locked dependencies.
- **API matrix images (compatibility):**
  - Scope: latest patch of the last two stable `@actual-app/api` majors.
  - Tags per image: `api-<patch>`, `api-<minor>`, `api-<major>` (e.g. `api-25.12.3`, `api-25.12`, `api-25`).
  - Purpose: let you match your Actual server’s API line without changing your app version.

## Choosing an Image Tag

- **You know your server’s API major (recommended):**
  - Use the major alias: `api-<MAJOR>` (e.g. `api-25`).
  - Pull example: `docker pull ghcr.io/rjlee/actual-investment-sync:api-25`
  - This keeps you on the newest compatible patch for that major.
- **You need a specific API patch:**
  - Use the patch tag: `api-<MAJOR.MINOR.PATCH>` (e.g. `api-25.12.3`).
- **You only care about the app release:**
  - Use the semantic‑release tag: `<app-version>` or `latest`.

### Tips

- You can list available tags via the GHCR UI under “Packages” for this repo
- If you run a self‑hosted Actual server, choose the image whose API major matches your server’s API line

### Compose Defaults

- The provided `docker-compose.yml` uses `api-${ACTUAL_API_MAJOR}` by default; set `ACTUAL_API_MAJOR` in your `.env` (e.g. `25`).
- Alternatively, use `:api-stable` to always follow the newest supported API major automatically.
