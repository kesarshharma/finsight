async function fetchAnalytics() {
  const symbol = document.getElementById("symbol").value;
  const res = await fetch(`/analytics/${symbol}`);
  const data = await res.json();
  document.getElementById("result").textContent = JSON.stringify(data, null, 2);
}
