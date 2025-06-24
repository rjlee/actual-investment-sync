const axios = require('axios');
const { getStockPrice, getPortfolioValue } = require('../src/portfolio-client');

jest.mock('axios');
// Provide dummy ALPHAVANTAGE_API_KEY for alphavantage provider tests
process.env.ALPHAVANTAGE_API_KEY = 'demo';
// Dummy keys for other providers
process.env.FINNHUB_API_KEY = 'demo';
process.env.TWELVEDATA_API_KEY = 'demo';

describe('getStockPrice', () => {
  it('returns price from FT HTML response', async () => {
    const html = `
      <div class="mod-tearsheet-overview__price">
        <ul class="mod-ui-data-list">
          <li>
            <span class="mod-ui-data-list__label">GBP</span>
            <span class="mod-ui-data-list__value">123.45</span>
          </li>
        </ul>
      </div>`;
    axios.get.mockResolvedValue({ data: html });
    const price = await getStockPrice('KEY');
    expect(price).toBe(123.45);
  });

  it('divides by 100 if GBX denomination', async () => {
    const html = `
      <div class="mod-tearsheet-overview__price">
        <ul class="mod-ui-data-list">
          <li>
            <span class="mod-ui-data-list__label">GBX</span>
            <span class="mod-ui-data-list__value">12345</span>
          </li>
        </ul>
      </div>`;
    axios.get.mockResolvedValue({ data: html });
    const price = await getStockPrice('KEY');
    expect(price).toBeCloseTo(123.45);
  });

  it('throws if no price data found', async () => {
    axios.get.mockResolvedValue({ data: '' });
    await expect(getStockPrice('KEY')).rejects.toThrow(/No price data/);
  });

  it('fetches price from AlphaVantage JSON response when provider is alphavantage', async () => {
    const apiResponse = { data: { 'Global Quote': { '05. price': '55.50' } } };
    axios.get.mockResolvedValueOnce(apiResponse);
    const price = await getStockPrice('SYM', 'alphavantage');
    expect(price).toBeCloseTo(55.5);
  });

  it('fetches price from Finnhub JSON response when provider is finnhub', async () => {
    axios.get.mockResolvedValueOnce({ data: { c: 123.45 } });
    const price = await getStockPrice('SYM', 'finnhub');
    expect(price).toBeCloseTo(123.45);
  });
  it('fetches price from TwelveData JSON response when provider is twelvedata', async () => {
    axios.get.mockResolvedValueOnce({ data: { price: '45.67' } });
    const price = await getStockPrice('SYM', 'twelvedata');
    expect(price).toBeCloseTo(45.67);
  });

  it('parses price from FT HTML via quote__bar selector', async () => {
    const html = `
      <ul class="mod-tearsheet-overview__quote__bar">
        <li>
          <span class="mod-ui-data-list__label">GBX</span>
          <span class="mod-ui-data-list__value">200</span>
        </li>
      </ul>`;
    axios.get.mockResolvedValueOnce({ data: html });
    const price = await getStockPrice('KEY');
    expect(price).toBeCloseTo(2.0);
  });

  it('parses price from Yahoo JSON inside FT fallback', async () => {
    const obj = { quoteResponse: { result: [{ regularMarketPrice: 321.5 }] } };
    axios.get.mockResolvedValueOnce({ data: obj });
    const price = await getStockPrice('KEY');
    expect(price).toBeCloseTo(321.5);
  });

  it('throws if no price data in HTML selectors', async () => {
    axios.get.mockResolvedValueOnce({ data: '<div><p>No price here</p></div>' });
    await expect(getStockPrice('KEY')).rejects.toThrow(/No price data for key KEY/);
  });

  it('throws if HTML value is non-numeric', async () => {
    const html = `
      <div class="mod-tearsheet-overview__price">
        <ul class="mod-ui-data-list">
          <li>
            <span class="mod-ui-data-list__label">USD</span>
            <span class="mod-ui-data-list__value">not-a-number</span>
          </li>
        </ul>
      </div>`;
    axios.get.mockResolvedValueOnce({ data: html });
    await expect(getStockPrice('KEY')).rejects.toThrow(/No price data for key KEY/);
  });
});

describe('getPortfolioValue', () => {
  it('calculates total value of portfolio', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: { quoteResponse: { result: [{ regularMarketPrice: 10 }] } },
      })
      .mockResolvedValueOnce({
        data: { quoteResponse: { result: [{ regularMarketPrice: 20 }] } },
      });
    const entry = {
      cash: 5,
      stocks: [
        { name: 'A', quantity: 2 },
        { name: 'B', quantity: 3 },
      ],
    };
    const stocksMap = { A: { key: 'A' }, B: { key: 'B' } };
    axios.get
      .mockResolvedValueOnce({
        data: `
        <div class="mod-tearsheet-overview__price">
          <ul class="mod-ui-data-list">
            <li>
              <span class="mod-ui-data-list__label">GBP</span>
              <span class="mod-ui-data-list__value">10</span>
            </li>
          </ul>
        </div>`,
      })
      .mockResolvedValueOnce({
        data: `
        <div class="mod-tearsheet-overview__price">
          <ul class="mod-ui-data-list">
            <li>
              <span class="mod-ui-data-list__label">GBP</span>
              <span class="mod-ui-data-list__value">20</span>
            </li>
          </ul>
        </div>`,
      });
    const total = await getPortfolioValue(entry, stocksMap);
    expect(total).toBe(5 + 2 * 10 + 3 * 20);
  });
});

// Error and edge-case tests for portfolio-client
describe('error cases in portfolio-client', () => {
  afterAll(() => {
    delete process.env.ALPHAVANTAGE_API_KEY;
    delete process.env.FINNHUB_API_KEY;
    delete process.env.TWELVEDATA_API_KEY;
  });

  it('getAlphaVantagePrice throws if no API key', async () => {
    delete process.env.ALPHAVANTAGE_API_KEY;
    await expect(getStockPrice('SYM', 'alphavantage')).rejects.toThrow(
      /AlphaVantage API key must be set/
    );
  });

  it('getAlphaVantagePrice throws on invalid price', async () => {
    process.env.ALPHAVANTAGE_API_KEY = 'demo';
    axios.get.mockResolvedValueOnce({ data: { 'Global Quote': { '05. price': 'NaN' } } });
    await expect(getStockPrice('SYM', 'alphavantage')).rejects.toThrow(
      /Invalid price data for key SYM/
    );
  });

  it('getFinnhubPrice throws if no API key', async () => {
    delete process.env.FINNHUB_API_KEY;
    await expect(getStockPrice('SYM', 'finnhub')).rejects.toThrow(/Finnhub API key must be set/);
  });

  it('getFinnhubPrice throws on invalid data type', async () => {
    process.env.FINNHUB_API_KEY = 'demo';
    axios.get.mockResolvedValueOnce({ data: { c: null } });
    await expect(getStockPrice('SYM', 'finnhub')).rejects.toThrow(/Invalid price data for key SYM/);
  });

  it('getTwelveDataPrice throws if no API key', async () => {
    delete process.env.TWELVEDATA_API_KEY;
    await expect(getStockPrice('SYM', 'twelvedata')).rejects.toThrow(
      /TwelveData API key must be set/
    );
  });

  it('getTwelveDataPrice throws on missing price', async () => {
    process.env.TWELVEDATA_API_KEY = 'demo';
    axios.get.mockResolvedValueOnce({ data: {} });
    await expect(getStockPrice('SYM', 'twelvedata')).rejects.toThrow(
      /No price data for key SYM from TwelveData/
    );
  });

  it('getTwelveDataPrice throws on invalid price', async () => {
    process.env.TWELVEDATA_API_KEY = 'demo';
    axios.get.mockResolvedValueOnce({ data: { price: 'abc' } });
    await expect(getStockPrice('SYM', 'twelvedata')).rejects.toThrow(
      /Invalid price data for key SYM from TwelveData/
    );
  });

  it('getPortfolioValue throws on unknown stock definition', async () => {
    await expect(
      getPortfolioValue({ cash: 0, stocks: [{ name: 'X', quantity: 1 }] }, {})
    ).rejects.toThrow(/Unknown stock definition: X/);
  });
});
