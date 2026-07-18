let chartInstance = null;

const dashboard = document.getElementById('dashboard');
const errorDiv = document.getElementById('error');
const loadingDiv = document.getElementById('loading');
const fetchBtn = document.getElementById('fetchBtn');
const symbolInput = document.getElementById('symbolInput');
const modalOverlay = document.getElementById('infoModal');
const summaryCard = document.getElementById('summaryCard');
const summaryText = document.getElementById('summaryText');

// Info data for each metric (unchanged)
const infoData = {
  price: {
    title: 'Latest Close Price',
    formula: 'Latest closing price = Pt',
    explain: 'The last traded price of the stock at the end of the most recent trading day.',
    meaning: 'Use this to see the current valuation. It is the baseline for all other calculations.'
  },
  sma: {
    title: '20-Day Simple Moving Average',
    formula: 'SMA20 = (P₁ + P₂ + ... + P₂₀) / 20',
    explain: 'Add the closing prices of the last 20 days and divide by 20.',
    meaning: 'Price above SMA => uptrend; below SMA => downtrend.'
  },
  volatility: {
    title: 'Annualized Volatility',
    formula: 'Daily σ = std(log returns)\nAnnual σ = Daily σ × √252',
    explain: 'Standard deviation of daily logarithmic returns, scaled to a year.',
    meaning: 'Higher volatility = larger price swings (higher risk/reward).'
  },
  rsi: {
    title: 'Relative Strength Index (14)',
    formula: 'RS = Avg Gain / Avg Loss over 14 days\nRSI = 100 - 100/(1+RS)',
    explain: 'Momentum oscillator between 0 and 100.',
    meaning: 'Over 70 = overbought (possible pullback); under 30 = oversold (possible rally).'
  },
  macd: {
    title: 'MACD',
    formula: 'MACD = 12‑period EMA − 26‑period EMA\nSignal = 9‑period EMA of MACD',
    explain: 'Trend‑following momentum indicator.',
    meaning: 'MACD crosses above Signal = bullish; crosses below = bearish.'
  },
  beta: {
    title: 'Beta (β)',
    formula: 'β = Cov(R_stock, R_market) / Var(R_market)',
    explain: 'Sensitivity to market (S&P 500).',
    meaning: 'β > 1 : more volatile than market; β < 1 : less volatile.'
  },
  pe: {
    title: 'P/E Ratio',
    formula: 'P/E = Price / Earnings Per Share (TTM)',
    explain: 'How much investors pay per dollar of earnings.',
    meaning: 'High P/E = growth expectations (or overvalued); Low P/E = possible undervaluation.'
  },
  marketcap: {
    title: 'Market Capitalization',
    formula: 'Market Cap = Price × Outstanding Shares',
    explain: 'Total market value of the company.',
    meaning: 'Large‑cap (>$10B) = stable; Small‑cap (<$2B) = higher growth/risk.'
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

// ---------- AI Summary Generator ----------
function generateSummary(history, analytics, enhanced) {
  // Use last 15 trading days from the history array
  const recent = history.slice(-15);
  if (recent.length < 5) return "Not enough data for a meaningful summary.";

  const firstPrice = recent[0].close;
  const lastPrice = recent[recent.length - 1].close;
  const priceChange = lastPrice - firstPrice;
  const percentChange = (priceChange / firstPrice) * 100;

  // Trend direction: simple linear regression or just compare first half vs second half
  const mid = Math.floor(recent.length / 2);
  const firstHalfAvg = recent.slice(0, mid).reduce((s, d) => s + d.close, 0) / mid;
  const secondHalfAvg = recent.slice(mid).reduce((s, d) => s + d.close, 0) / (recent.length - mid);
  let trendDesc = '';
  let outlook = '';
  if (secondHalfAvg > firstHalfAvg * 1.02) {
    trendDesc = 'trending upward';
    outlook = 'bullish';
  } else if (secondHalfAvg < firstHalfAvg * 0.98) {
    trendDesc = 'declining';
    outlook = 'bearish';
  } else {
    trendDesc = 'moving sideways';
    outlook = 'neutral';
  }

  // Daily swing (volatility proxy): average absolute daily change
  let dailyChanges = [];
  for (let i = 1; i < recent.length; i++) {
    dailyChanges.push(Math.abs(recent[i].close - recent[i-1].close));
  }
  const avgDailyMove = dailyChanges.reduce((a, b) => a + b, 0) / dailyChanges.length;
  const avgDailyPercent = (avgDailyMove / lastPrice) * 100;
  let swingDesc = '';
  if (avgDailyPercent > 2) swingDesc = 'extremely volatile, with large daily swings';
  else if (avgDailyPercent > 1) swingDesc = 'somewhat volatile, with noticeable daily moves';
  else swingDesc = 'relatively stable, with small daily changes';

  // Incorporate annualized volatility from analytics for risk context
  const annualVol = analytics.volatility * 100; // as percent
  let riskLevel = '';
  if (annualVol > 40) riskLevel = 'very high risk';
  else if (annualVol > 25) riskLevel = 'high risk';
  else if (annualVol > 15) riskLevel = 'moderate risk';
  else riskLevel = 'low risk';

  const symbolName = enhanced.name || enhanced.symbol;

  const summary = `${symbolName} has been **${trendDesc}** over the last 15 trading days. ` +
    `The price changed by **${percentChange.toFixed(1)}%** (from $${firstPrice.toFixed(2)} to $${lastPrice.toFixed(2)}). ` +
    `The stock is **${swingDesc}**, and its annualized volatility is **${annualVol.toFixed(1)}%**, indicating **${riskLevel}**. ` +
    `Overall, the short‑term outlook appears **${outlook}**.`;

  return summary;
}

// ---------- Main Fetch ----------
async function fetchData() {
  const symbol = symbolInput.value.trim().toUpperCase();
  if (!symbol) return;

  dashboard.classList.add('hidden');
  summaryCard.classList.add('hidden');
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

    // Populate basic cards
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

    // Generate AI summary
    const summary = generateSummary(historyData.history, analytics, enhanced);
    summaryText.textContent = summary;
    summaryCard.classList.remove('hidden');

    // Draw chart
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