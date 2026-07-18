"""Unit tests for the analytics service."""

import pytest
from src.services.analytics import compute_sma, compute_volatility

def test_compute_sma_basic():
    data = [10, 20, 30, 40, 50]
    result = compute_sma(data, window=3)
    assert result == [20.0, 30.0, 40.0]  # (10+20+30)/3, (20+30+40)/3, (30+40+50)/3

def test_compute_sma_window_larger_than_data():
    data = [10, 20]
    result = compute_sma(data, window=5)
    assert result == []  # Not enough data points

def test_compute_sma_empty_data():
    data = []
    result = compute_sma(data, window=3)
    assert result == []

def test_compute_volatility_basic():
    data = [2, 4, 6, 8, 10]
    result = compute_volatility(data)
    expected = 3.3025  # annualized volatility from log returns
    assert abs(result - expected) < 0.01

def test_compute_volatility_insufficient_data():
    data = [100]  # Only one price, can't compute returns
    result = compute_volatility(data)
    assert result == 0.0
