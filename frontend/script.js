let chartInstance = null;

const dashboard = document.getElementById('dashboard');
const errorDiv = document.getElementById('error');
const loadingDiv = document.getElementById('loading');
const fetchBtn = document.getElementById('fetchBtn');
const symbolInput = document.getElementById('symbolInput');

fetchBtn.addEventListener('click', fetchData);
symbolInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') fetchData();
});

async function fetchData() {
  const symbol = symbolInput.value.trim().toUpperCase();
  if (!symbol) return;

  // Show loading, hide previous results
  dashboard.classList.add('hidden');
  errorDiv.classList.add('hidden');
  loadingDiv.classList.remove('hidden');

  try {
    // Fetch analytics
    const analyticsRes = await fetch(`/analytics/${symbol}`);
    if (!analyticsRes.ok) throw new Error('Symbol not found or insufficient data');
    const analytics = await analyticsRes.json();

    // Fetch historical data for chart
    const historyRes = await fetch(`/historical/${symbol}`);
    if (!historyRes.ok) throw new Error('Could not fetch historical data');
    const historyData = await historyRes.json();

    // Populate cards
    document.getElementById('price').textContent = `$${analytics.latest_close}`;
    document.getElementById('sma').textContent = `$${analytics.sma_20}`;
    document.getElementById('volatility').textContent = `${(analytics.volatility * 100).toFixed(2)}%`;
    document.getElementById('symbolName').textContent = symbol;

    // Draw chart
    drawChart(historyData.history, analytics.sma_20);

    // Show dashboard
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

  // Calculate SMA line for the chart (use last 20 points for visual overlay)
  const smaValues = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < 19) {
      smaValues.push(null);
    } else {
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
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 0,
          fill: true,
        },
        {
          label: '20-Day SMA',
          data: smaValues,
          borderColor: '#7c4dff',
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#ccc',
            usePointStyle: true,
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        }
      },
      scales: {
        x: {
          ticks: { color: '#888', maxTicksLimit: 8 },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          ticks: { color: '#888', callback: v => '$' + v },
          grid: { color: 'rgba(255,255,255,0.05)' },
        }
      }
    }
  });
}