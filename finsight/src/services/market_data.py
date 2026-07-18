"""Fetches historical stock price data from Yahoo Finance."""

import yfinance as yf
from src.core.config import DEFAULT_PERIOD


def fetch_stock_data(symbol: str, period: str = None) -> list[float] | None:
    """
    Returns a list of closing prices for the given symbol.
    Returns None if the symbol is invalid or data is empty.
    """
    if period is None:
        period = DEFAULT_PERIOD

    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period)

        if hist.empty:
            return None

        closing_prices = hist["Close"].tolist()
        return closing_prices

    except Exception:
        return None
