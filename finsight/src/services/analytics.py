"""Financial analytics functions: SMA and volatility."""

def compute_sma(prices: list[float], window: int) -> list[float]:
    """Return list of simple moving averages over the given window."""
    if len(prices) < window:
        return []
    return [sum(prices[i:i+window]) / window for i in range(len(prices) - window + 1)]

def compute_volatility(prices: list[float]) -> float:
    """Annualized volatility from daily closing prices (simplified)."""
    if len(prices) < 2:
        return 0.0
    # Daily logarithmic returns
    import math
    returns = [math.log(prices[i] / prices[i-1]) for i in range(1, len(prices))]
    mean_return = sum(returns) / len(returns)
    variance = sum((r - mean_return) ** 2 for r in returns) / (len(returns) - 1)  # sample variance
    daily_vol = variance ** 0.5
    annual_vol = daily_vol * (252 ** 0.5)  # 252 trading days
    return round(annual_vol, 4)
