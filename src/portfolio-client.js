const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('./logger');

/**
 * Fetch current price for a given stock key using Financial Times tearsheet,
 * falling back to parsing HTML if necessary, and also supporting Yahoo JSON quotes.
 * @param {string} key
 * @returns {Promise<number>}
 */
async function getFTPrice(key) {
  const FT_URL = 'https://markets.ft.com/data/funds/tearsheet/summary?s=';
  try {
    const resp = await axios.get(FT_URL + encodeURIComponent(key), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
          + '(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const data = resp.data;
    // Support Yahoo JSON quoteResponse first
    if (data && typeof data === 'object' && data.quoteResponse && Array.isArray(data.quoteResponse.result)) {
      const jm = data.quoteResponse.result[0].regularMarketPrice;
      if (typeof jm === 'number') return jm;
    }
    // Fallback to HTML parsing of FT tearsheet (support a couple of FT layouts)
    const $ = cheerio.load(data);
    const selectors = [
      'div.mod-tearsheet-overview__price ul.mod-ui-data-list li',
      'ul.mod-tearsheet-overview__quote__bar li',
    ];
    let priceItem;
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length && el.find('span.mod-ui-data-list__value').length) {
        priceItem = el;
        break;
      }
    }
    if (!priceItem || !priceItem.length) {
      throw new Error(`No price data for key ${key}`);
    }
    let priceText = priceItem.find('span.mod-ui-data-list__value').text().trim();
    priceText = priceText.replace(/,/g, '');
    const denom = priceItem.find('span.mod-ui-data-list__label').text().trim();
    let price = parseFloat(priceText);
    if (denom.includes('GBX')) price = price / 100;
    if (isNaN(price)) {
      throw new Error(`No price data for key ${key}`);
    }
    return price;
  } catch (err) {
    logger.error({ err, key }, 'Failed to fetch stock price from FT');
    throw err;
  }
}

/**
 * Fetch current price for a given stock key using AlphaVantage API.
 * @param {string} key
 * @returns {Promise<number>}
 */
async function getAlphaVantagePrice(key) {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error(`AlphaVantage API key must be set via ALPHAVANTAGE_API_KEY`);
  }
  try {
    const resp = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: key,
        apikey: apiKey,
      },
    });
    const quote = resp.data['Global Quote'];
    const priceText = quote && quote['05. price'];
    if (!priceText) {
      throw new Error(`No price data for key ${key} from AlphaVantage`);
    }
    const price = parseFloat(priceText.replace(/,/g, ''));
    if (isNaN(price)) {
      throw new Error(`Invalid price data for key ${key} from AlphaVantage: ${priceText}`);
    }
    return price;
  } catch (err) {
    logger.error({ err, key }, 'Failed to fetch stock price from AlphaVantage');
    throw err;
  }
}

/**
 * Fetch current price for a given stock key using Finnhub.io API.
 * @param {string} key
 * @returns {Promise<number>}
 */
async function getFinnhubPrice(key) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error(`Finnhub API key must be set via FINNHUB_API_KEY`);
  }
  try {
    const resp = await axios.get('https://finnhub.io/api/v1/quote', {
      params: { symbol: key, token: apiKey },
    });
    const price = resp.data?.c;
    if (typeof price !== 'number') {
      throw new Error(`Invalid price data for key ${key} from Finnhub`);
    }
    return price;
  } catch (err) {
    logger.error({ err, key }, 'Failed to fetch stock price from Finnhub');
    throw err;
  }
}

/**
 * Fetch current price for a given stock key using Twelve Data API.
 * @param {string} key
 * @returns {Promise<number>}
 */
async function getTwelveDataPrice(key) {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    throw new Error(`TwelveData API key must be set via TWELVEDATA_API_KEY`);
  }
  try {
    const resp = await axios.get('https://api.twelvedata.com/price', {
      params: { symbol: key, apikey: apiKey },
    });
    const priceText = resp.data?.price;
    if (!priceText) {
      throw new Error(`No price data for key ${key} from TwelveData`);
    }
    const price = parseFloat(priceText.replace(/,/g, ''));
    if (isNaN(price)) {
      throw new Error(`Invalid price data for key ${key} from TwelveData: ${priceText}`);
    }
    return price;
  } catch (err) {
    logger.error({ err, key }, 'Failed to fetch stock price from TwelveData');
    throw err;
  }
}

/**
 * Fetch current price for a given stock key using configured provider.
 * Defaults to FT tearsheet.
 * @param {string} key
 * @param {string} [provider]
 * @returns {Promise<number>}
 */
async function getStockPrice(key, provider = 'ft') {
  if (provider === 'alphavantage') {
    return getAlphaVantagePrice(key);
  } else if (provider === 'finnhub') {
    return getFinnhubPrice(key);
  } else if (provider === 'twelvedata') {
    return getTwelveDataPrice(key);
  }
  return getFTPrice(key);
}

/**
 * Calculate total value of a portfolio entry using defined stocks mapping.
 *
 * @param {{ cash?: number, stocks: Array<{ name: string, quantity: number }> }} entry
 * @param {{ [name: string]: { key: string, provider?: string } }} stocksMap
 * @returns {Promise<number>}
 */
async function getPortfolioValue(entry, stocksMap) {
  let total = typeof entry.cash === 'number' ? entry.cash : 0;
  for (const { name, quantity } of entry.stocks) {
    const def = stocksMap[name];
    if (!def) throw new Error(`Unknown stock definition: ${name}`);
      const price = await getStockPrice(def.key, def.provider);
    total += price * quantity;
  }
  return Number(total.toFixed(2));
}

module.exports = { getStockPrice, getPortfolioValue };