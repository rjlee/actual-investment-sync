require('dotenv').config();
const fs = require('fs');
const path = require('path');
const api = require('@actual-app/api');
const logger = require('./logger');
const config = require('./config');

let hasDownloadedBudget = false;

async function openBudget() {
  const url = process.env.ACTUAL_SERVER_URL;
  const password = process.env.ACTUAL_PASSWORD;
  const syncId = process.env.ACTUAL_SYNC_ID;
  if (!url || !password || !syncId) {
    throw new Error(
      'Please set ACTUAL_SERVER_URL, ACTUAL_PASSWORD, and ACTUAL_SYNC_ID environment variables'
    );
  }
  const dataDir = process.env.DATA_DIR || config.DATA_DIR || 'data';
  const budgetDir = process.env.BUDGET_DIR || config.BUDGET_DIR || path.join(dataDir, 'budget');

  const resolvedBudgetDir = path.isAbsolute(budgetDir)
    ? budgetDir
    : path.join(process.cwd(), budgetDir);
  fs.mkdirSync(resolvedBudgetDir, { recursive: true });

  logger.info('Connecting to Actual API...');
  await api.init({ dataDir: resolvedBudgetDir, serverURL: url, password });

  const opts = {};
  const budgetPassword = process.env.ACTUAL_BUDGET_ENCRYPTION_PASSWORD;
  if (budgetPassword) opts.password = budgetPassword;

  if (!hasDownloadedBudget) {
    logger.info('Downloading budget (no backup)...');
    try {
      await api.downloadBudget(syncId, opts);
      logger.info('Budget downloaded');
      hasDownloadedBudget = true;
    } catch (err) {
      logger.warn({ err }, 'Failed to download budget');
    }
  }

  logger.info('Syncing budget changes...');
  try {
    await api.sync();
    logger.info('Budget synced');
  } catch (err) {
    logger.warn({ err }, 'Failed to sync budget');
  }
}

async function closeBudget() {
  // Reset flag so reopen re-downloads budget/prefs
  hasDownloadedBudget = false;
  try {
    await api.shutdown();
    if (typeof api.resetBudgetCache === 'function') {
      await api.resetBudgetCache();
    }
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

module.exports = { openBudget, closeBudget };
