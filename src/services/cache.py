"""Redis caching layer for stock analytics."""

import json
import redis
from src.core.config import REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_CACHE_TTL_SECONDS


# Connect to Redis (lazy connection, won't fail at import time)
def _get_redis_client() -> redis.Redis:
    return redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        decode_responses=True  # automatically decode bytes to strings
    )


def get_cached_analytics(symbol: str) -> dict | None:
    """Return cached analytics dict for a symbol, or None if not present."""
    try:
        r = _get_redis_client()
        data = r.get(f"analytics:{symbol}")
        if data:
            return json.loads(data)
    except redis.ConnectionError:
        pass  # Redis is down or not yet started — fail gracefully
    return None


def set_cached_analytics(symbol: str, analytics: dict) -> None:
    """Store analytics dict in Redis with a TTL."""
    try:
        r = _get_redis_client()
        r.setex(
            f"analytics:{symbol}",
            REDIS_CACHE_TTL_SECONDS,
            json.dumps(analytics)
        )
    except redis.ConnectionError:
        pass  # Silently skip caching if Redis is unavailable
    