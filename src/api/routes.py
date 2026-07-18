"""FastAPI route definitions for the FinSight API."""

from fastapi import APIRouter, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os, math
from datetime import datetime, timedelta

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


@router.get("/historical/{symbol}")
async def historical(symbol: str):
    import yfinance as yf
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="6mo")
        if hist.empty:
            raise HTTPException(status_code=404, detail="No data found")
        data = [
            {"date": date.strftime("%Y-%m-%d"), "close": round(row["Close"], 2)}
            for date, row in hist.iterrows()
        ]
        return {"symbol": symbol.upper(), "history": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/enhanced/{symbol}")
async def enhanced_analytics(symbol: str):
    import yfinance as yf
    try:
        stock = yf.Ticker(symbol)
        info = stock.info
        hist = stock.history(period="1y")

        if hist.empty:
            raise HTTPException(status_code=404, detail="No data found")

        close_prices = hist["Close"].tolist()
        latest = round(close_prices[-1], 2)

        # RSI (14 days)
        delta = hist["Close"].diff()
        gain = delta.where(delta > 0, 0.0)
        loss = -delta.where(delta < 0, 0.0)
        avg_gain = gain.rolling(window=14).mean().iloc[-1]
        avg_loss = loss.rolling(window=14).mean().iloc[-1]
        if avg_loss == 0:
            rsi = 100
        else:
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
        rsi = round(rsi, 1)

        # MACD
        ema12 = hist["Close"].ewm(span=12, adjust=False).mean()
        ema26 = hist["Close"].ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        signal = macd_line.ewm(span=9, adjust=False).mean()
        macd_value = round(macd_line.iloc[-1], 4)
        signal_value = round(signal.iloc[-1], 4)
        histogram = round(macd_value - signal_value, 4)

        # Beta vs S&P 500 (^GSPC)
        spy = yf.Ticker("^GSPC").history(period="1y")["Close"]
        combined = hist["Close"].to_frame("stock").merge(
            spy.to_frame("spy"), left_index=True, right_index=True
        )
        returns = combined.pct_change().dropna()
        if not returns.empty:
            covariance = returns["stock"].cov(returns["spy"])
            variance = returns["spy"].var()
            beta = round(covariance / variance, 2) if variance != 0 else None
        else:
            beta = None

        # Fundamentals
        pe_ratio = info.get("trailingPE", "N/A")
        market_cap = info.get("marketCap", None)
        if market_cap:
            if market_cap >= 1e12:
                market_cap_str = f"${market_cap / 1e12:.2f}T"
            elif market_cap >= 1e9:
                market_cap_str = f"${market_cap / 1e9:.2f}B"
            else:
                market_cap_str = f"${market_cap:,.0f}"
        else:
            market_cap_str = "N/A"

        high_52w = info.get("fiftyTwoWeekHigh", "N/A")
        low_52w = info.get("fiftyTwoWeekLow", "N/A")

        return {
            "symbol": symbol.upper(),
            "name": info.get("longName", symbol.upper()),
            "latest_price": latest,
            "rsi": rsi,
            "macd": {
                "macd_line": macd_value,
                "signal": signal_value,
                "histogram": histogram,
            },
            "beta": beta,
            "pe_ratio": pe_ratio,
            "market_cap": market_cap_str,
            "52w_high": high_52w,
            "52w_low": low_52w,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------- Serve the frontend dashboard --------
frontend_path = os.path.join(os.path.dirname(__file__), "../../frontend")
if os.path.exists(frontend_path):
    router.mount("/static", StaticFiles(directory=frontend_path), name="static")

    @router.get("/")
    async def read_index():
        return FileResponse(os.path.join(frontend_path, "index.html"))