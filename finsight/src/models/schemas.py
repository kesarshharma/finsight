"""Pydantic models for API request and response validation."""

from pydantic import BaseModel

class AnalyticsResponse(BaseModel):
    symbol: str
    latest_close: float
    sma_20: float
    volatility: float

class HealthResponse(BaseModel):
    status: str
