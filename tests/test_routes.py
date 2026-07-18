"""Integration tests for the FastAPI endpoints."""

from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_analytics_endpoint_valid_symbol(monkeypatch):
    # Mock the service to avoid real API calls and Redis dependency
    def mock_get_analytics(symbol):
        return {
            "symbol": symbol,
            "latest_close": 150.0,
            "sma_20": 148.5,
            "volatility": 0.015
        }
    
    from src.api import routes
    monkeypatch.setattr(routes, "get_stock_analytics", mock_get_analytics)

    response = client.get("/analytics/AAPL")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert "latest_close" in data
    assert "sma_20" in data
    assert "volatility" in data

def test_analytics_endpoint_invalid_symbol(monkeypatch):
    def mock_get_analytics(symbol):
        return None  # simulate not found
    
    from src.api import routes
    monkeypatch.setattr(routes, "get_stock_analytics", mock_get_analytics)

    response = client.get("/analytics/INVALID")
    assert response.status_code == 404