const { getStockPrice } = require('./portfolio-client');

/**
 * Build lookup map for stock definitions keyed by friendly name.
 * @param {Array<{name: string, key: string, provider?: string}>} stocks
 */
function buildStocksLookup(stocks) {
  const map = {};
  for (const stock of stocks || []) {
    if (stock && stock.name) {
      map[stock.name] = { key: stock.key, provider: stock.provider };
    }
  }
  return map;
}

/**
 * Fetch prices for every unique stock referenced by the portfolios.
 * @param {Array<{stocks?: Array<{name: string}>}>} portfolios
 * @param {Record<string, {key: string, provider?: string}>} stocksLookup
 */
async function resolvePriceMap(portfolios, stocksLookup) {
  const uniqueNames = new Set();
  for (const portfolio of portfolios || []) {
    for (const holding of portfolio?.stocks || []) {
      if (!holding?.name) continue;
      if (!stocksLookup[holding.name]) {
        throw new Error(`Unknown stock definition: ${holding.name}`);
      }
      uniqueNames.add(holding.name);
    }
  }

  const priceEntries = await Promise.all(
    Array.from(uniqueNames).map(async (name) => {
      const def = stocksLookup[name];
      const price = await getStockPrice(def.key, def.provider);
      return [name, price];
    })
  );
  return Object.fromEntries(priceEntries);
}

/**
 * Build portfolio snapshots including holdings with calculated prices/values.
 * @param {Array} portfolios
 * @param {Record<string, {key: string, provider?: string}>} stocksLookup
 */
async function buildPortfolioSnapshots(portfolios, stocksLookup) {
  const priceMap = await resolvePriceMap(portfolios, stocksLookup);
  return (portfolios || []).map((portfolio) => {
    const cash = typeof portfolio.cash === 'number' ? portfolio.cash : Number(portfolio.cash) || 0;
    const holdings = [];
    let holdingsValue = 0;
    for (const holding of portfolio?.stocks || []) {
      if (!holding?.name) continue;
      const def = stocksLookup[holding.name];
      if (!def) {
        throw new Error(`Unknown stock definition: ${holding.name}`);
      }
      const quantity =
        typeof holding.quantity === 'number' ? holding.quantity : Number(holding.quantity) || 0;
      const price = priceMap[holding.name];
      if (typeof price !== 'number' || Number.isNaN(price)) {
        throw new Error(`Failed to resolve price for ${holding.name}`);
      }
      const marketValue = Number((quantity * price).toFixed(2));
      holdings.push({
        name: holding.name,
        symbol: def.key || '',
        provider: def.provider || 'ft',
        quantity,
        price,
        marketValue,
      });
      holdingsValue += marketValue;
    }
    const totalValue = Number((cash + holdingsValue).toFixed(2));
    return {
      name: portfolio.name || '',
      accountId: portfolio.accountId || '',
      cash: Number(cash.toFixed(2)),
      stocks: holdings,
      totalValue,
    };
  });
}

function formatNumber(value, decimals) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return typeof decimals === 'number' ? value.toFixed(decimals) : value.toString();
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str === '') return '';
  if (/["\n,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(columns, rows) {
  const header = columns.map(escapeCsvCell).join(',');
  const body = rows
    .map((row) => columns.map((col) => escapeCsvCell(row[col])).join(','))
    .join('\n');
  return [header, body].filter(Boolean).join('\n');
}

/**
 * Create CSV rows for position-level export.
 * @param {Array} snapshots
 * @param {Array<{id: string, name: string}>} accounts
 * @param {string} exportedAt ISO timestamp
 */
function formatPositionsCsv(snapshots, accounts, exportedAt) {
  const accountNames = {};
  for (const account of accounts || []) {
    if (account?.id) {
      accountNames[account.id] = account.name || '';
    }
  }
  const columns = [
    'Portfolio',
    'ActualAccountName',
    'ActualAccountId',
    'AssetType',
    'HoldingName',
    'Symbol',
    'Provider',
    'Quantity',
    'UnitPrice',
    'MarketValue',
    'PortfolioCash',
    'PortfolioValue',
    'WeightPct',
    'ExportedAt',
  ];
  const rows = [];
  for (const snapshot of snapshots || []) {
    const baseRow = {
      Portfolio: snapshot.name || '',
      ActualAccountName: accountNames[snapshot.accountId] || '',
      ActualAccountId: snapshot.accountId || '',
      PortfolioCash: formatNumber(snapshot.cash, 2),
      PortfolioValue: formatNumber(snapshot.totalValue, 2),
      ExportedAt: exportedAt,
    };
    for (const holding of snapshot.stocks || []) {
      const weight = snapshot.totalValue ? (holding.marketValue / snapshot.totalValue) * 100 : null;
      rows.push({
        ...baseRow,
        AssetType: 'Position',
        HoldingName: holding.name,
        Symbol: holding.symbol,
        Provider: holding.provider || 'ft',
        Quantity: formatNumber(holding.quantity),
        UnitPrice: formatNumber(holding.price, 4),
        MarketValue: formatNumber(holding.marketValue, 2),
        WeightPct: weight !== null ? formatNumber(weight, 4) : '',
      });
    }
    rows.push({
      ...baseRow,
      AssetType: 'Cash',
      HoldingName: 'Cash Balance',
      Symbol: '',
      Provider: '',
      Quantity: '',
      UnitPrice: '',
      MarketValue: formatNumber(snapshot.cash, 2),
      WeightPct:
        snapshot.totalValue && snapshot.totalValue !== 0
          ? formatNumber((snapshot.cash / snapshot.totalValue) * 100, 4)
          : '',
    });
  }
  return toCsv(columns, rows);
}

/**
 * Create CSV rows aggregated by holding across portfolios.
 * @param {Array} snapshots
 * @param {string} exportedAt ISO timestamp
 */
function formatHoldingsCsv(snapshots, exportedAt) {
  const columns = [
    'HoldingName',
    'Symbol',
    'Provider',
    'TotalQuantity',
    'UnitPrice',
    'TotalMarketValue',
    'ExportedAt',
  ];
  const aggregate = {};
  for (const snapshot of snapshots || []) {
    for (const holding of snapshot.stocks || []) {
      if (!aggregate[holding.name]) {
        aggregate[holding.name] = {
          HoldingName: holding.name,
          Symbol: holding.symbol,
          Provider: holding.provider || 'ft',
          TotalQuantity: 0,
          UnitPrice: holding.price,
          TotalMarketValue: 0,
          ExportedAt: exportedAt,
        };
      }
      aggregate[holding.name].TotalQuantity += holding.quantity;
      aggregate[holding.name].TotalMarketValue += holding.marketValue;
    }
  }
  const rows = Object.values(aggregate).map((row) => ({
    ...row,
    TotalQuantity: formatNumber(row.TotalQuantity),
    UnitPrice: formatNumber(row.UnitPrice, 4),
    TotalMarketValue: formatNumber(row.TotalMarketValue, 2),
  }));
  return toCsv(columns, rows);
}

/**
 * Generate CSV for the requested format.
 * @param {'positions'|'holdings'} format
 * @param {{stocks?: Array, portfolios?: Array}} mapping
 * @param {Array} accounts
 */
async function generateExportCsv(format, mapping, accounts) {
  const stocksLookup = buildStocksLookup(mapping?.stocks || []);
  const snapshots = await buildPortfolioSnapshots(mapping?.portfolios || [], stocksLookup);
  const exportedAt = new Date().toISOString();
  if (format === 'positions') {
    return formatPositionsCsv(snapshots, accounts, exportedAt);
  }
  if (format === 'holdings') {
    return formatHoldingsCsv(snapshots, exportedAt);
  }
  throw new Error(`Unsupported export format: ${format}`);
}

module.exports = {
  buildStocksLookup,
  buildPortfolioSnapshots,
  formatPositionsCsv,
  formatHoldingsCsv,
  generateExportCsv,
};
