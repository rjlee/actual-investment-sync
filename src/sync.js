const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const config = require('./config');
const api = require('@actual-app/api');
const { openBudget, closeBudget } = require('./utils');
const portfolioClient = require('./portfolio-client');
const { v4: uuidv4 } = require('uuid');

/**
 * Sync portfolio values to Actual Budget accounts.
 * @param {{verbose?: boolean, useLogger?: boolean}} options
 * @returns {Promise<number>} Number of portfolio syncs applied
 */
async function runSync({ verbose = false, useLogger = false } = {}) {
  const log =
    verbose || useLogger
      ? logger
      : { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} };
  const cwd = process.cwd();
  const mappingFile = process.env.MAPPING_FILE || config.MAPPING_FILE || './data/mapping.json';
  const mappingPath = path.isAbsolute(mappingFile)
    ? mappingFile
    : path.join(cwd, mappingFile);

  // Load or initialize mapping entries
  // Load or initialize mapping entries (stocks & portfolios)
  let mapping = { stocks: [], portfolios: [] };
  try {
    const data = fs.readFileSync(mappingPath, 'utf8');
    mapping = JSON.parse(data);
  } catch (err) {
    log.warn(
      { err, mappingPath },
      'Failed to load or parse mapping file; starting with empty mapping'
    );
  }
  const stocksArr = Array.isArray(mapping.stocks) ? mapping.stocks : [];
  const portfolios = Array.isArray(mapping.portfolios) ? mapping.portfolios : [];
  if (verbose) log.debug({ mappingPath, stocks: stocksArr.length, portfolios: portfolios.length }, 'Loaded mapping entries');

  log.info('Opening Actual Budget');
  try {
    await openBudget();
  } catch (err) {
    log.error({ err }, 'Failed to open budget; aborting sync');
    return 0;
  }

  let applied = 0;
  try {
    const accounts = await api.getAccounts();
    const accountIds = accounts.map((a) => a.id);

    // build stocks lookup
    const stocksMap = {};
    for (const s of stocksArr) {
      stocksMap[s.name] = s;
    }
    for (const entry of portfolios) {
      const acctId = entry.accountId;
      if (!accountIds.includes(acctId)) {
        log.warn({ accountId: acctId }, 'Actual account not found; skipping');
        continue;
      }
      // only sync if calculated portfolio value differs from current actual-budget balance
      let currentValue;
      try {
        currentValue = await portfolioClient.getPortfolioValue(entry, stocksMap);
      } catch (err) {
        log.error({ err, portfolio: entry.name }, 'Failed to calculate portfolio value; skipping');
        continue;
      }
      let budgetBalance;
      try {
        budgetBalance = await api.getAccountBalance(acctId, new Date());
      } catch (err) {
        log.error({ err, accountId: acctId }, 'Failed to fetch account balance; skipping');
        continue;
      }
      // api returns balance in minor units (cents/pence)
      const budgetMajor = budgetBalance / 100;
      const delta = currentValue - budgetMajor;
      // skip negligible change smaller than half a cent/pence in major units
      if (Math.abs(delta) < 0.005) {
        continue;
      }
      log.info({ portfolio: entry.name, delta }, 'Syncing portfolio change');
      const PAYEE_NAME = 'actual-investment-sync';
      let payees = [];
      try {
        payees = await api.getPayees();
      } catch {
        /* ignore errors fetching payees */
      }
      let payeeId = payees.find((p) => p.name === PAYEE_NAME)?.id;
      if (!payeeId) {
        try {
          payeeId = await api.createPayee({ name: PAYEE_NAME });
        } catch (err) {
          log.warn({ err, PAYEE_NAME }, 'Failed to create payee; using raw name');
        }
      }
      if (!entry.id) {
        entry.id = uuidv4();
      }
      // Convert delta (float in major currency units) to minor units (integer, e.g. pence)
      const amountMinor = Math.round(delta * 100);
      const tx = {
        id: `${entry.id}-${Date.now()}`,
        date: new Date(),
        amount: amountMinor,
        payee: payeeId || PAYEE_NAME,
        imported_payee: PAYEE_NAME,
      };
      try {
        await api.addTransactions(acctId, [tx], {
          runTransfers: false,
          learnCategories: false,
        });
        entry.lastBalance = currentValue;
        applied++;
      } catch (err) {
        log.error({ err, tx }, 'Failed to add transaction; skipping');
      }
    }

    // Save updated mapping atomically
    try {
      mapping.portfolios = portfolios;
      mapping.stocks = stocksArr;
      const tmpFile = `${mappingPath}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(mapping, null, 2));
      fs.renameSync(tmpFile, mappingPath);
    } catch (err) {
      log.error({ err, mappingPath }, 'Failed to save mapping file atomically');
    }
    log.info({ applied }, 'Completed portfolio sync');
  } catch (err) {
    log.error({ err }, 'Error during sync');
  } finally {
    await closeBudget();
  }
  return applied;
}

module.exports = { runSync };