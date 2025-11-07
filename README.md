# actual-investment-sync

Synchronise investment or portfolio balances into Actual Budget. Fetch latest prices from supported providers, aggregate per portfolio, and push adjustment transactions to mapped Actual accounts on a schedule or via the web UI.

## Features

- Provider-agnostic fetch layer (AlphaVantage, Finnhub, TwelveData; extendable).
- Web UI to map symbols → portfolios → Actual accounts and trigger manual syncs.
- Cron-driven daemon with optional debug/headful Puppeteer mode.
- Docker image with health check and persistent state volume.

## Requirements

- Node.js ≥ 20.
- Actual Budget server credentials (`ACTUAL_SERVER_URL`, `ACTUAL_PASSWORD`, `ACTUAL_SYNC_ID`).
- Provider API keys depending on the data source (see `.env.example`).

## Installation

```bash
git clone https://github.com/rjlee/actual-investment-sync.git
cd actual-investment-sync
npm install
```

Optional husky hooks:

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

Prebuilt images: `ghcr.io/rjlee/actual-investment-sync:<tag>` (see [Image tags](#image-tags)).

## Configuration

- `.env` – required Actual credentials, provider API keys, cron overrides, etc.
- `config.yaml` / `config.yml` / `config.json` – optional defaults (copy from `config.example.yaml`).

Precedence: CLI flags > environment variables > config file.

Key options:

| Setting                                                              | Description                | Default              |
| -------------------------------------------------------------------- | -------------------------- | -------------------- |
| `DATA_DIR`                                                           | App data (mappings, cache) | `./data`             |
| `BUDGET_DIR`                                                         | Budget cache location      | `./data/budget`      |
| `SYNC_CRON` / `SYNC_CRON_TIMEZONE`                                   | Cron schedule              | `45 * * * *` / `UTC` |
| `DISABLE_CRON_SCHEDULING`                                            | Disable cron in daemon     | `false`              |
| `HTTP_PORT`                                                          | Web UI port                | `3000`               |
| `ALPHAVANTAGE_API_KEY`, `FINNHUB_API_KEY`, `TWELVEDATA_API_KEY`, ... | Provider credentials       | unset                |

## Usage

### Local

```bash
# One-off sync
npm run sync

# Daemon (cron + web UI)
npm run daemon -- --ui --http-port 3000
```

Open `http://localhost:3000` (or your configured port) to map accounts and trigger manual syncs.

### Docker

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

- `ghcr.io/rjlee/actual-investment-sync:<semver>` – pinned API version (match your Actual server).
- `ghcr.io/rjlee/actual-investment-sync:latest` – highest supported API release.

## Security considerations

- Web UI authentication is enabled by default (`UI_AUTH_ENABLED=true`). Set a strong `SESSION_SECRET` (defaults to `ACTUAL_PASSWORD`).
- Serve over HTTPS by providing `SSL_KEY`/`SSL_CERT`.
- Disable the UI (`UI_AUTH_ENABLED=false` and omit `--ui`) once mappings are stable if you prefer headless operation.

## License

MIT © contributors.
