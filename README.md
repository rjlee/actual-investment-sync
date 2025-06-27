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
2. Copy `config.example.yaml` to `config.yaml` if you need to override defaults (e.g. `SYNC_CRON`, `SYNC_CRON_TIMEZONE`, `HTTP_PORT`, `MAPPING_FILE`).
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

| Variable             | Default     | Description                       |
| -------------------- | ----------- | --------------------------------- |
| `SYNC_CRON`          | `0 * * * *` | Cron expression for periodic sync |
| `SYNC_CRON_TIMEZONE` | `UTC`       | Time zone for the cron schedule   |

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
