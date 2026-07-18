"""FastAPI route definitions for the FinSight API."""

from fastapi import APIRouter, HTTPException
from src.models.schemas import AnalyticsResponse, HealthResponse
from src.services.market_data import fetch_stock_data
from src.services.analytics import compute_sma, compute_volatility
from src.services.cache import get_cached_analytics, set_cached_analytics

router = APIRouter()


def get_stock_analytics(symbol: str) -> dict | None:
    """
    Core logic: check cache → fetch data → compute → store in cache.
    Returns a dict ready for AnalyticsResponse, or None if symbol invalid.
    """
    # 1. Check Redis cache
    cached = get_cached_analytics(symbol)
    if cached:
        return cached

    # 2. Fetch fresh market data
    prices = fetch_stock_data(symbol)
    if prices is None or len(prices) < 20:
        return None  # Need at least 20 days for SMA-20

    # 3. Compute analytics
    latest_close = round(prices[-1], 2)
    sma_values = compute_sma(prices, window=20)
    sma_20 = round(sma_values[-1], 2) if sma_values else 0.0
    volatility = compute_volatility(prices)

    result = {
        "symbol": symbol.upper(),
        "latest_close": latest_close,
        "sma_20": sma_20,
        "volatility": volatility,
    }

    # 4. Store in cache for future requests
    set_cached_analytics(symbol, result)

    return result


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="healthy")


@router.get("/analytics/{symbol}", response_model=AnalyticsResponse)
async def analytics(symbol: str):
    data = get_stock_analytics(symbol)
    if data is None:
        raise HTTPException(status_code=404, detail="Symbol not found or insufficient data")
    return AnalyticsResponse(**data)
