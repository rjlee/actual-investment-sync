/* eslint-env browser */
// Dynamic UI for managing stocks, portfolios, and syncing values
(async function () {
  const budgetEl = document.getElementById('budgetStatus');
  const statusEl = document.getElementById('status');

  let stocksConfig = [];
  let portfoliosConfig = [];
  let accounts = [];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function pollBudget() {
    // intentionally loop until budget is ready
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const res = await fetch('/api/budget-status');
        const { ready } = await res.json();
        if (ready) {
          budgetEl.textContent = 'Budget downloaded';
          budgetEl.className = 'badge bg-success';
          break;
        }
      } catch {
        // ignore errors while polling budget status
      }
      budgetEl.textContent = 'Budget downloading';
      budgetEl.className = 'badge bg-info';
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1000));
    }
    await loadData();
  }

  async function loadData() {
    try {
      const res = await fetch('/api/data');
      const json = await res.json();
      stocksConfig = Array.isArray(json.stocks) ? json.stocks : [];
      portfoliosConfig = Array.isArray(json.portfolios) ? json.portfolios : [];
      accounts = Array.isArray(json.accounts) ? json.accounts : [];
      renderStocks();
      renderPortfolios();
    } catch (err) {
      console.error('Failed to load data', err);
    }
  }

  function getStockRowHtml(stock, sIndex) {
    return `
      <tr>
        <td><input type="text" class="form-control form-control-sm stock-name" data-s="${sIndex}" value="${escapeHtml(
          stock.name
        )}"/></td>
        <td><input type="text" class="form-control form-control-sm stock-key" data-s="${sIndex}" value="${escapeHtml(
          stock.key
        )}" placeholder="Symbol"/></td>
        <td>
          <select class="form-select form-select-sm stock-provider" data-s="${sIndex}">
            <option value="ft"${stock.provider !== 'alphavantage' && stock.provider !== 'finnhub' && stock.provider !== 'twelvedata' ? ' selected' : ''}>FT</option>
            <option value="alphavantage"${stock.provider === 'alphavantage' ? ' selected' : ''}>AlphaVantage</option>
            <option value="finnhub"${stock.provider === 'finnhub' ? ' selected' : ''}>Finnhub</option>
            <option value="twelvedata"${stock.provider === 'twelvedata' ? ' selected' : ''}>TwelveData</option>
          </select>
        </td>
        <td><button type="button" class="btn-close btn-remove-stock" data-s="${sIndex}" aria-label="Remove"></button></td>
      </tr>`;
  }

  function renderStocks() {
    const container = document.getElementById('stocks');
    container.innerHTML = `
      <table class="table table-sm table-bordered mb-2">
        <thead><tr><th>Name</th><th>Symbol</th><th>Provider</th><th></th></tr></thead>
        <tbody></tbody>
      </table>`;
    const tbody = container.querySelector('tbody');
    stocksConfig.forEach((stock, sIndex) => {
      tbody.insertAdjacentHTML('beforeend', getStockRowHtml(stock, sIndex));
    });
    attachStockHandlers();
  }

  function attachStockHandlers() {
    document.querySelectorAll('.btn-remove-stock').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = parseInt(btn.dataset.s, 10);
        stocksConfig.splice(s, 1);
        renderStocks();
      });
    });
    document.querySelectorAll('.stock-name').forEach((input) => {
      input.addEventListener('input', (e) => {
        const s = parseInt(e.target.dataset.s, 10);
        stocksConfig[s].name = e.target.value;
      });
    });
    document.querySelectorAll('.stock-key').forEach((input) => {
      input.addEventListener('input', (e) => {
        const s = parseInt(e.target.dataset.s, 10);
        stocksConfig[s].key = e.target.value;
      });
    });
    document.getElementById('addStockBtn').onclick = () => {
      stocksConfig.push({ name: '', key: '', provider: 'ft' });
      renderStocks();
    };
    document.querySelectorAll('.stock-provider').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        stocksConfig[parseInt(e.target.dataset.s, 10)].provider = e.target.value;
      });
    });
  }

  function getPortfolioRowHtml(portfolio, pIndex) {
    return `
      <div class="card mb-3">
        <div class="card-body">
          <button type="button" class="btn-close btn-remove-portfolio" data-p="${pIndex}" aria-label="Remove"></button>
          <div class="mb-3">
            <label class="form-label">Name</label>
            <input type="text" class="form-control portfolio-name" data-p="${pIndex}" value="${escapeHtml(
              portfolio.name
            )}"/>
          </div>
          <div class="mb-3 row">
            <div class="col">
              <label class="form-label">Cash</label>
              <input type="number" step="0.01" class="form-control portfolio-cash" data-p="${pIndex}" value="${portfolio.cash || 0}"/>
            </div>
            <div class="col">
              <label class="form-label">Account</label>
              <select class="form-select portfolio-account" data-p="${pIndex}">
                <option value="">-- none --</option>
                ${accounts
                  .map(
                    (ac) =>
                      `<option value="${escapeHtml(ac.id)}"${
                        ac.id === portfolio.accountId ? ' selected' : ''
                      }>${escapeHtml(ac.name)}</option>`
                  )
                  .join('')}
              </select>
            </div>
          </div>
          <div class="mb-3">
            <h5>Stocks</h5>
            <table class="table table-sm table-bordered mb-2">
              <thead><tr><th>Stock</th><th>Qty</th><th></th></tr></thead>
              <tbody></tbody>
            </table>
            <button type="button" class="btn btn-sm btn-outline-secondary btn-add-portfolio-stock" data-p="${pIndex}">Add Stock</button>
          </div>
        </div>
      </div>`;
  }

  function renderPortfolios() {
    const container = document.getElementById('portfolios');
    container.innerHTML = '';
    portfoliosConfig.forEach((pf, pIndex) => {
      container.insertAdjacentHTML('beforeend', getPortfolioRowHtml(pf, pIndex));
      const tbl = container.lastElementChild.querySelector('tbody');
      (pf.stocks || []).forEach((st, sIndex) => {
        const select = document.createElement('select');
        select.className = 'form-select form-select-sm stock-select';
        select.dataset.p = pIndex;
        select.dataset.s = sIndex;
        select.innerHTML =
          `<option value="">-- none --</option>` +
          stocksConfig
            .map(
              (sc) =>
                `<option value="${escapeHtml(sc.name)}"${
                  sc.name === st.name ? ' selected' : ''
                }>${escapeHtml(sc.name)}</option>`
            )
            .join('');
        const qty = document.createElement('input');
        qty.type = 'number';
        qty.step = '0.0001';
        qty.className = 'form-control form-control-sm stock-qty';
        qty.dataset.p = pIndex;
        qty.dataset.s = sIndex;
        qty.value = st.quantity;
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'btn-close btn-remove-portfolio-stock';
        rm.dataset.p = pIndex;
        rm.dataset.s = sIndex;
        const row = document.createElement('tr');
        row.innerHTML = `<td></td><td></td><td></td>`;
        row.children[0].appendChild(select);
        row.children[1].appendChild(qty);
        row.children[2].appendChild(rm);
        tbl.appendChild(row);
      });
    });
    attachPortfolioHandlers();
  }

  function attachPortfolioHandlers() {
    document.querySelectorAll('.btn-remove-portfolio').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.p, 10);
        portfoliosConfig.splice(p, 1);
        renderPortfolios();
      });
    });
    document.querySelectorAll('.portfolio-name').forEach((input) => {
      input.addEventListener('input', (e) => {
        portfoliosConfig[parseInt(e.target.dataset.p, 10)].name = e.target.value;
      });
    });
    document.querySelectorAll('.portfolio-cash').forEach((input) => {
      input.addEventListener('input', (e) => {
        portfoliosConfig[parseInt(e.target.dataset.p, 10)].cash = parseFloat(e.target.value) || 0;
      });
    });
    document.querySelectorAll('.portfolio-account').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        portfoliosConfig[parseInt(e.target.dataset.p, 10)].accountId = e.target.value;
      });
    });
    document.querySelectorAll('.btn-add-portfolio-stock').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.p, 10);
        portfoliosConfig[p].stocks = portfoliosConfig[p].stocks || [];
        portfoliosConfig[p].stocks.push({ name: '', quantity: 0 });
        renderPortfolios();
      });
    });
    document.querySelectorAll('.stock-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const p = parseInt(e.target.dataset.p, 10);
        const s = parseInt(e.target.dataset.s, 10);
        portfoliosConfig[p].stocks[s].name = e.target.value;
      });
    });
    document.querySelectorAll('.stock-qty').forEach((input) => {
      input.addEventListener('input', (e) => {
        const p = parseInt(e.target.dataset.p, 10);
        const s = parseInt(e.target.dataset.s, 10);
        portfoliosConfig[p].stocks[s].quantity = parseFloat(e.target.value) || 0;
      });
    });
  }

  document.getElementById('addPortfolioBtn').onclick = () => {
    portfoliosConfig.push({ name: '', cash: 0, accountId: '', stocks: [] });
    renderPortfolios();
  };

  document.getElementById('saveBtn').onclick = async () => {
    statusEl.textContent = 'Saving configuration...';
    try {
      const res = await fetch('/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stocks: stocksConfig, portfolios: portfoliosConfig }),
      });
      if (!res.ok) throw new Error('Save failed');
      statusEl.textContent = 'Configuration saved';
      await loadData();
    } catch (err) {
      statusEl.textContent = 'Error: ' + err.message;
    }
  };

  document.getElementById('syncBtn').onclick = async () => {
    statusEl.textContent = 'Syncing...';
    const btn = document.getElementById('syncBtn');
    btn.disabled = true;
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      statusEl.textContent = 'Synced ' + data.count + ' portfolio(s)';
    } catch (err) {
      statusEl.textContent = 'Error: ' + err.message;
    } finally {
      btn.disabled = false;
    }
  };

  // Initialize UI
  pollBudget();
})();
