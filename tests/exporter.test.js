const { generateExportCsv } = require('../src/exporter');

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
