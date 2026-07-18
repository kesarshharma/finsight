"""Central configuration for the FinSight API. Loads from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()  # Load .env file if present (local dev)

# Redis configuration – defaults for local Docker
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_CACHE_TTL_SECONDS = int(os.getenv("REDIS_CACHE_TTL_SECONDS", "3600"))  # 1 hour

# API settings
API_TITLE = "FinSight API"
API_VERSION = "1.0.0"
API_DESCRIPTION = "Lightweight investment analytics for retail investors."

# Market data settings
DEFAULT_PERIOD = "6mo"  # yfinance period for historical data
