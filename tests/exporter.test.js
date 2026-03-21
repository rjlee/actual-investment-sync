const {
  generateExportCsv,
  formatPositionsJson,
  formatHoldingsJson,
  buildStocksLookup,
  buildPortfolioSnapshots,
} = require('../src/exporter');

jest.mock('../src/portfolio-client', () => ({
  getStockPrice: jest.fn(),
}));

const { getStockPrice } = require('../src/portfolio-client');

const mapping = {
  stocks: [
    { name: 'Fund A', key: 'AAA', provider: 'ft' },
    { name: 'Fund B', key: 'BBB', provider: 'alphavantage' },
  ],
  portfolios: [
    {
      name: 'Portfolio 1',
      cash: 50,
      accountId: 'acct-1',
      stocks: [
        { name: 'Fund A', quantity: 2 },
        { name: 'Fund B', quantity: 3 },
      ],
    },
    {
      name: 'Portfolio 2',
      cash: 0,
      accountId: 'acct-2',
      stocks: [{ name: 'Fund A', quantity: 1 }],
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  getStockPrice.mockImplementation(async (key) => {
    if (key === 'AAA') return 10;
    if (key === 'BBB') return 20;
    throw new Error(`Unknown key ${key}`);
  });
});

describe('generateExportCsv', () => {
  it('produces position-level CSV with expected columns and values', async () => {
    const accounts = [
      { id: 'acct-1', name: 'First Account' },
      { id: 'acct-2', name: 'Second Account' },
    ];
    const csv = await generateExportCsv('positions', mapping, accounts);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Portfolio,ActualAccountName,ActualAccountId');
    expect(csv).toContain('Portfolio 1,First Account,acct-1,Position,Fund A,AAA,ft,2');
    const cashRow = lines.find((line) => line.includes('Cash Balance'));
    expect(cashRow).toBeTruthy();
    expect(getStockPrice).toHaveBeenCalledTimes(2); // one per unique holding
  });

  it('aggregates holdings by stock', async () => {
    const csv = await generateExportCsv('holdings', mapping, []);
    const rows = csv.split('\n');
    expect(rows[0]).toContain('HoldingName,Symbol,Provider,TotalQuantity');
    expect(csv).toContain('Fund A,AAA,ft,3,10.0000,30.00');
    expect(csv).toContain('Fund B,BBB,alphavantage,3,20.0000,60.00');
  });

  it('throws on unsupported formats', async () => {
    await expect(generateExportCsv('unknown', mapping, [])).rejects.toThrow(
      'Unsupported export format'
    );
  });
});

describe('formatPositionsJson', () => {
  it('returns positions with all expected fields', async () => {
    const accounts = [
      { id: 'acct-1', name: 'First Account' },
      { id: 'acct-2', name: 'Second Account' },
    ];
    const stocksLookup = buildStocksLookup(mapping.stocks);
    const snapshots = await buildPortfolioSnapshots(mapping.portfolios, stocksLookup);
    const positions = formatPositionsJson(snapshots, accounts);

    expect(positions).toHaveLength(5); // 2 holdings + 1 cash (Portfolio 1) + 1 holding + 1 cash (Portfolio 2)

    const fundA = positions.find((p) => p.holdingName === 'Fund A' && p.assetType === 'Position');
    expect(fundA).toMatchObject({
      portfolio: 'Portfolio 1',
      actualAccountName: 'First Account',
      actualAccountId: 'acct-1',
      symbol: 'AAA',
      provider: 'ft',
      quantity: 2,
      unitPrice: 10,
      marketValue: 20,
    });

    const cash = positions.find((p) => p.assetType === 'Cash');
    expect(cash).toMatchObject({
      portfolio: 'Portfolio 1',
      holdingName: 'Cash Balance',
      marketValue: 50,
    });
  });
});

describe('formatHoldingsJson', () => {
  it('aggregates holdings across portfolios', async () => {
    const stocksLookup = buildStocksLookup(mapping.stocks);
    const snapshots = await buildPortfolioSnapshots(mapping.portfolios, stocksLookup);
    const holdings = formatHoldingsJson(snapshots);

    expect(holdings).toHaveLength(2); // Fund A and Fund B

    const fundA = holdings.find((h) => h.holdingName === 'Fund A');
    expect(fundA).toMatchObject({
      holdingName: 'Fund A',
      symbol: 'AAA',
      provider: 'ft',
      totalQuantity: 3, // 2 from Portfolio 1 + 1 from Portfolio 2
      unitPrice: 10,
      totalMarketValue: 30,
    });

    const fundB = holdings.find((h) => h.holdingName === 'Fund B');
    expect(fundB).toMatchObject({
      holdingName: 'Fund B',
      symbol: 'BBB',
      provider: 'alphavantage',
      totalQuantity: 3,
      unitPrice: 20,
      totalMarketValue: 60,
    });
  });
});
