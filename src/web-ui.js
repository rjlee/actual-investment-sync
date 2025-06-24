require('dotenv').config();
const express = require('express');
const path = require('path');
const ejs = require('ejs');
const fs = require('fs');
const https = require('https');
const cookieSession = require('cookie-session');
const logger = require('./logger');
const config = require('./config');
const api = require('@actual-app/api');
const { openBudget } = require('./utils');
const { runSync } = require('./sync');

// Helper to wrap async route handlers and forward errors to the global error handler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Generate the HTML for the UI page via EJS template
 */
function uiPageHtml(uiAuthEnabled) {
  const templatePath = path.join(__dirname, 'views', 'index.ejs');
  const template = fs.readFileSync(templatePath, 'utf8');
  return ejs.render(template, { uiAuthEnabled }, { filename: templatePath });
}

/**
 * Launch the Express-based UI server
 */
async function startWebUi(httpPort, verbose) {
  let budgetReady = false;
  Promise.resolve(openBudget())
    .then(() => {
      budgetReady = true;
    })
    .catch((err) => {
      logger.error({ err }, 'Budget download failed');
      budgetReady = true;
    });

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  if (process.env.SSL_KEY && process.env.SSL_CERT) {
    const sslOpts = {
      key: fs.readFileSync(process.env.SSL_KEY),
      cert: fs.readFileSync(process.env.SSL_CERT),
    };
    return https.createServer(sslOpts, app).listen(httpPort, () => {
      logger.info({ port: httpPort }, 'Web UI HTTPS server listening');
    });
  }

  const UI_AUTH_ENABLED = process.env.UI_AUTH_ENABLED !== 'false';
  if (UI_AUTH_ENABLED) {
    const SECRET = process.env.ACTUAL_PASSWORD;
    if (!SECRET) {
      logger.error('ACTUAL_PASSWORD must be set to enable UI authentication');
      process.exit(1);
    }
    app.use(express.urlencoded({ extended: false }));
    app.use(
      cookieSession({
        name: 'session',
        keys: [process.env.SESSION_SECRET || SECRET],
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: Boolean(process.env.SSL_KEY && process.env.SSL_CERT),
        sameSite: 'strict',
      })
    );

    const LOGIN_PATH = '/login';
    const loginForm = (error) => {
      const templatePath = path.join(__dirname, 'views', 'login.ejs');
      const template = fs.readFileSync(templatePath, 'utf8');
      return ejs.render(template, { error, LOGIN_PATH }, { filename: templatePath });
    };

    app.get(LOGIN_PATH, (_req, res) => res.send(loginForm()));
    app.post(LOGIN_PATH, (req, res) => {
      if (req.body.password === SECRET) {
        req.session.authenticated = true;
        return res.redirect(req.query.next || '/');
      }
      return res.status(401).send(loginForm('Invalid password'));
    });

    app.use((req, res, next) => {
      if (req.session.authenticated) {
        return next();
      }
      return res.send(loginForm());
    });

    app.post('/logout', (req, res) => {
      req.session = null;
      res.redirect(LOGIN_PATH);
    });
  }

  app.use((req, res, next) => {
    const meta = { method: req.method, url: req.url };
    if (verbose) {
      meta.headers = req.headers;
      meta.query = req.query;
      if (req.body) meta.body = req.body;
    }
    logger.info(meta, 'HTTP request');
    next();
  });
  const mappingFile = process.env.MAPPING_FILE || config.MAPPING_FILE || './data/mapping.json';

  app.get(
    '/',
    asyncHandler(async (_req, res) => {
      if (budgetReady) {
        try {
          await api.sync();
          const opts = {};
          if (process.env.ACTUAL_BUDGET_ENCRYPTION_PASSWORD) {
            opts.password = process.env.ACTUAL_BUDGET_ENCRYPTION_PASSWORD;
          }
          await api.downloadBudget(process.env.ACTUAL_BUDGET_ID, opts);
        } catch (err) {
          logger.error({ err }, 'Failed to sync/download budget on page load');
        }
      }
      res.send(uiPageHtml(UI_AUTH_ENABLED));
    })
  );

  app.get(
    '/api/data',
    asyncHandler(async (_req, res) => {
      let mapping = { stocks: [], portfolios: [] };
      try {
        mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
      } catch {
        // no mapping file or invalid JSON
      }

      let accountsList = [];
      try {
        accountsList = await api.getAccounts();
      } catch (err) {
        logger.error({ err }, 'Failed to fetch Actual Budget accounts');
      }

      return res.json({
        stocks: mapping.stocks,
        portfolios: mapping.portfolios,
        accounts: accountsList,
      });
    })
  );

  app.get('/api/budget-status', (_req, res) => {
    res.json({ ready: budgetReady });
  });

  app.post('/api/mappings', (req, res) => {
    fs.writeFileSync(mappingFile, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  });

  app.post(
    '/api/sync',
    asyncHandler(async (_req, res) => {
      const count = await runSync({ verbose: false, useLogger: true });
      res.json({ count });
    })
  );

  app.use((err, req, res, next) => {
    logger.error({ err, method: req.method, url: req.url }, 'Web UI route error');
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ error: err.message });
  });

  const server = app.listen(httpPort, () => {
    const realPort = server.address().port;
    logger.info({ port: realPort }, 'Web UI server listening');
  });
  return server;
}

module.exports = { startWebUi };
