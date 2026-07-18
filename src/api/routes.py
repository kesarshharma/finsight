"""FastAPI route definitions for the FinSight API."""

from fastapi import APIRouter, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from src.models.schemas import AnalyticsResponse, HealthResponse
from src.services.market_data import fetch_stock_data
from src.services.analytics import compute_sma, compute_volatility
from src.services.cache import get_cached_analytics, set_cached_analytics

router = APIRouter()


def get_stock_analytics(symbol: str) -> dict | None:
    """Core logic: check cache → fetch data → compute → store in cache."""
    cached = get_cached_analytics(symbol)
    if cached:
        return cached

    prices = fetch_stock_data(symbol)
    if prices is None or len(prices) < 20:
        return None

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


# New endpoint: returns historical prices for charting
@router.get("/historical/{symbol}")
async def historical(symbol: str):
    import yfinance as yf
    from datetime import datetime, timedelta

    try:
        ticker = yf.Ticker(symbol)
        # Fetch 6 months of daily data
        hist = ticker.history(period="6mo")
        if hist.empty:
            raise HTTPException(status_code=404, detail="No data found")

        # Prepare data for chart: list of {date, close}
        data = [
            {
                "date": date.strftime("%Y-%m-%d"),
                "close": round(row["Close"], 2)
            }
            for date, row in hist.iterrows()
        ]
        return {"symbol": symbol.upper(), "history": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------- Serve the frontend dashboard --------
frontend_path = os.path.join(os.path.dirname(__file__), "../../frontend")
if os.path.exists(frontend_path):
    router.mount("/static", StaticFiles(directory=frontend_path), name="static")

    @router.get("/")
    async def read_index():
        return FileResponse(os.path.join(frontend_path, "index.html"))
    