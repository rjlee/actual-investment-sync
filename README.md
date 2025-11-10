# actual-investment-sync

Synchronise investment or portfolio balances into Actual Budget. Fetches prices from supported providers, aggregates per portfolio, and posts adjustment transactions on a schedule or via the Web UI.

## Features

- Provider-agnostic fetch layer (AlphaVantage, Finnhub, TwelveData) with an extensible adapter pattern.
- Web UI for mapping symbols → portfolios → Actual accounts and triggering manual syncs, designed to sit behind a shared forward-auth proxy such as `actual-auto-auth`.
- Cron-driven daemon with optional headful Puppeteer mode for debugging provider flows.
- Docker image with baked-in health check and persistent data volume.

## Requirements

- Node.js ≥ 22.
- Actual Budget server credentials (`ACTUAL_SERVER_URL`, `ACTUAL_PASSWORD`, `ACTUAL_SYNC_ID`).
- Provider API keys (AlphaVantage, Finnhub, TwelveData) depending on the sources you enable.

## Installation

```bash
git clone https://github.com/rjlee/actual-investment-sync.git
cd actual-investment-sync
npm install
```

Optional git hooks:

```bash
npm run prepare
```

### Docker quick start

```bash
cp .env.example .env
docker build -t actual-investment-sync .
mkdir -p data/budget
docker run -d --env-file .env \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  actual-investment-sync --mode daemon --ui
```

Published images live at `ghcr.io/rjlee/actual-investment-sync:<tag>` (see [Image tags](#image-tags)).

Prefer Docker Compose? Two samples are included:

- `docker-compose.yml` – exposes the Web UI directly on `HTTP_PORT`.
- `docker-compose.with-auth.yml.example` – bundles Traefik plus
  [`actual-auto-auth`](https://github.com/rjlee/actual-auto-auth) so the UI is
  protected by the shared password prompt; copy it to `docker-compose.yml`,
  adjust `AUTH_APP_NAME` / `AUTH_COOKIE_NAME`, and ensure `ACTUAL_PASSWORD` is
  provided so the auth sidecar can sign cookies.

## Configuration

- `.env` – primary configuration, copy from `.env.example`.
- `config.yaml` / `config.yml` / `config.json` – optional defaults, copy from `config.example.yaml`.

Precedence: CLI flags > environment variables > config file.

| Setting                            | Description                                    | Default              |
| ---------------------------------- | ---------------------------------------------- | -------------------- |
| `DATA_DIR`                         | Local storage for mappings and cached data     | `./data`             |
| `BUDGET_DIR`                       | Budget cache directory                         | `./data/budget`      |
| `SYNC_CRON` / `SYNC_CRON_TIMEZONE` | Daemon cron schedule                           | `45 * * * *` / `UTC` |
| `DISABLE_CRON_SCHEDULING`          | Disable cron while in daemon mode              | `false`              |
| `HTTP_PORT`                        | Enables Web UI when set or `--ui` passed       | `3000`               |
| `AUTH_COOKIE_NAME`                 | Cookie name forwarded by Traefik for logout UI | `actual-auth`        |
| `LOG_LEVEL`                        | Pino log level                                 | `info`               |
| `ALPHAVANTAGE_API_KEY`             | API key for AlphaVantage provider              | unset                |
| `FINNHUB_API_KEY`                  | API key for Finnhub provider                   | unset                |
| `TWELVEDATA_API_KEY`               | API key for TwelveData provider                | unset                |
| `ENABLE_NODE_VERSION_SHIM`         | Legacy shim for older `@actual-app/api` checks | `false`              |

## Usage

### CLI modes

- One-off sync: `npm run sync`
- Daemon with UI: `npm run daemon -- --ui --http-port 3000`
- Disable cron in daemon: `DISABLE_CRON_SCHEDULING=true npm run daemon`

Visit `http://localhost:3000` (or your configured port) to map portfolios, update credentials, and trigger manual syncs. In production, place the UI behind a forward-auth proxy (for example the shared `actual-auto-auth` service) so access is password protected.

### Docker daemon

```bash
docker run --rm --env-file .env \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/rjlee/actual-investment-sync:latest --mode daemon --ui
```

## Testing & linting

```bash
npm test
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## Image tags

- `ghcr.io/rjlee/actual-investment-sync:<semver>` – pinned to a specific `@actual-app/api` release.
- `ghcr.io/rjlee/actual-investment-sync:latest` – highest supported API version.

See [rjlee/actual-auto-ci](https://github.com/rjlee/actual-auto-ci) for tagging policy and automation details.

## License

MIT © contributors.
