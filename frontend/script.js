let chartInstance = null;

const dashboard = document.getElementById('dashboard');
const errorDiv = document.getElementById('error');
const loadingDiv = document.getElementById('loading');
const fetchBtn = document.getElementById('fetchBtn');
const symbolInput = document.getElementById('symbolInput');
const modalOverlay = document.getElementById('infoModal');

// Info data for each metric
const infoData = {
  price: {
    title: 'Latest Close Price',
    formula: 'Latest closing price = Pt',
    explain: 'The last traded price of the stock at the end of the most recent trading day. It reflects the consensus value of the stock at that moment.',
    meaning: 'Use this to see the current valuation. It is the baseline for all other calculations.'
  },
  sma: {
    title: '20-Day Simple Moving Average',
    formula: 'SMA20 = (P₁ + P₂ + ... + P₂₀) / 20',
    explain: 'Add the closing prices of the last 20 days and divide by 20. This smooths out daily noise and shows the general trend direction.',
    meaning: 'If the price is above the SMA, the trend is up. If below, the trend is down. Crosses can signal trend changes.'
  },
  volatility: {
    title: 'Annualized Volatility',
    formula: 'Daily return: r_t = ln(P_t / P_{t-1})\nDaily σ = std(r_t)\nAnnual σ = Daily σ × √252',
    explain: 'Calculated as the standard deviation of daily logarithmic returns, then scaled to a full year using 252 trading days. Expressed as a decimal (e.g., 0.27 = 27%).',
    meaning: 'Higher volatility means larger price swings – higher risk but also higher potential reward. Low volatility suggests a more stable stock.'
  },
  rsi: {
    title: 'Relative Strength Index (14)',
    formula: 'RS = Average Gain / Average Loss over 14 periods\nRSI = 100 - 100/(1+RS)',
    explain: 'Measures the speed and change of price movements. Oscillates between 0 and 100.',
    meaning: 'RSI > 70 typically indicates overbought (potential pullback). RSI < 30 indicates oversold (potential rally). Centerline crosses also give signals.'
  },
  macd: {
    title: 'MACD (Moving Average Convergence Divergence)',
    formula: 'MACD Line = 12-period EMA - 26-period EMA\nSignal Line = 9-period EMA of MACD\nHistogram = MACD - Signal',
    explain: 'A trend-following momentum indicator that shows the relationship between two moving averages.',
    meaning: 'When MACD crosses above the Signal line, it is a bullish signal. When it crosses below, it is bearish. The histogram visualizes the difference.'
  },
  beta: {
    title: 'Beta (β)',
    formula: 'β = Covariance(R_stock, R_market) / Variance(R_market)',
    explain: 'Measures the stock\'s sensitivity to market movements (S&P 500). A beta of 1 means it moves with the market.',
    meaning: 'β > 1: more volatile than the market (aggressive). β < 1: less volatile (defensive). Negative beta moves opposite to market.'
  },
  pe: {
    title: 'Price-to-Earnings Ratio (P/E)',
    formula: 'P/E = Stock Price / Earnings Per Share (TTM)',
    explain: 'Shows how much investors are willing to pay per dollar of earnings. Trailing P/E uses the last 12 months of earnings.',
    meaning: 'A high P/E may indicate growth expectations or overvaluation. A low P/E could mean undervaluation or declining business. Compare within the same industry.'
  },
  marketcap: {
    title: 'Market Capitalization',
    formula: 'Market Cap = Share Price × Total Outstanding Shares',
    explain: 'The total market value of a company’s outstanding shares. Categorizes the company size.',
    meaning: 'Large-cap (>$10B): stable, mature companies. Mid-cap ($2B–10B): growth potential. Small-cap (<$2B): higher risk, higher growth.'
  }
};

function showInfo(metric) {
  const data = infoData[metric];
  if (!data) return;
  document.getElementById('modalTitle').textContent = data.title;
  document.getElementById('modalFormula').textContent = data.formula;
  document.getElementById('modalExplanation').textContent = data.explain;
  document.getElementById('modalMeaning').textContent = data.meaning;
  modalOverlay.classList.remove('hidden');
}

function closeModal() {
  modalOverlay.classList.add('hidden');
}

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

fetchBtn.addEventListener('click', fetchData);
symbolInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') fetchData();
});

async function fetchData() {
  const symbol = symbolInput.value.trim().toUpperCase();
  if (!symbol) return;

  dashboard.classList.add('hidden');
  errorDiv.classList.add('hidden');
  loadingDiv.classList.remove('hidden');

  try {
    const analyticsRes = await fetch(`/analytics/${symbol}`);
    if (!analyticsRes.ok) throw new Error('Symbol not found or insufficient data');
    const analytics = await analyticsRes.json();

    const enhancedRes = await fetch(`/enhanced/${symbol}`);
    if (!enhancedRes.ok) throw new Error('Could not fetch enhanced analytics');
    const enhanced = await enhancedRes.json();

    const historyRes = await fetch(`/historical/${symbol}`);
    if (!historyRes.ok) throw new Error('Could not fetch historical data');
    const historyData = await historyRes.json();

    // Basic cards
    document.getElementById('price').textContent = `$${analytics.latest_close}`;
    document.getElementById('sma').textContent = `$${analytics.sma_20}`;
    document.getElementById('volatility').textContent = `${(analytics.volatility * 100).toFixed(2)}%`;

    // Company name and ticker
    document.getElementById('companyName').textContent = enhanced.name || symbol;
    document.getElementById('tickerSymbol').textContent = enhanced.symbol;

    // Enhanced cards
    document.getElementById('rsi').textContent = enhanced.rsi ?? '—';
    document.getElementById('macd_value').textContent = enhanced.macd?.macd_line?.toFixed(4) ?? '—';
    document.getElementById('macd_signal').textContent = enhanced.macd?.signal?.toFixed(4) ?? '—';
    document.getElementById('macd_hist').textContent = enhanced.macd?.histogram?.toFixed(4) ?? '—';
    document.getElementById('beta').textContent = enhanced.beta ?? '—';
    document.getElementById('pe').textContent = enhanced.pe_ratio ?? '—';
    document.getElementById('marketcap').textContent = enhanced.market_cap ?? '—';
    document.getElementById('high52').textContent = enhanced['52w_high'] ?? '—';
    document.getElementById('low52').textContent = enhanced['52w_low'] ?? '—';

    drawChart(historyData.history, analytics.sma_20);
    dashboard.classList.remove('hidden');
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('hidden');
  } finally {
    loadingDiv.classList.add('hidden');
  }
}

function drawChart(history, sma20) {
  const ctx = document.getElementById('priceChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  const dates = history.map(h => h.date);
  const closes = history.map(h => h.close);
  const smaValues = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < 19) smaValues.push(null);
    else {
      const slice = closes.slice(i - 19, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / 20;
      smaValues.push(avg);
    }
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Close Price',
          data: closes,
          borderColor: '#00bcd4',
          backgroundColor: 'rgba(0, 188, 212, 0.1)',
          borderWidth: 2, tension: 0.2, pointRadius: 0, fill: true,
        },
        {
          label: '20-Day SMA',
          data: smaValues,
          borderColor: '#7c4dff',
          borderWidth: 2, tension: 0.2, pointRadius: 0, fill: false,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#ccc', usePointStyle: true } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { ticks: { color: '#888', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#888', callback: v => '$' + v }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}