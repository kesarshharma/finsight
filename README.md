
**Request flow:**
1. Client calls `/analytics/AAPL`
2. API checks Redis for cached result. If **cache hit**, return immediately.
3. If **cache miss**, fetch 6‑months of closing prices from Yahoo Finance.
4. Compute 20‑day SMA and annualized volatility.
5. Store result in Redis with 1‑hour TTL.
6. Return JSON to client.

**Scalability highlights:**
- **Stateless API**: any number of instances can run behind a load balancer.
- **Redis as a shared cache**: reduces load on external data source and speeds up repeated queries.
- **Graceful degradation**: if Redis is down, the API still works (just without caching).

---

## 📊 Success Metrics
- **Cache hit rate > 90%** after the first hour of live traffic
- **p99 latency < 50 ms** for cached responses
- **API uptime 99.9%**
- **Zero mandatory sign‑up** – removing friction for the target user

These metrics were defined *before* writing code, reflecting a data‑driven product mindset.

---

## 🛠️ Tech Stack
| Layer | Technology | Why |
|-------|------------|-----|
| API framework | FastAPI | High performance, automatic OpenAPI docs, async‑ready |
| Data source | yfinance | Free, reliable Yahoo Finance wrapper |
| Caching | Redis | Sub‑millisecond reads, TTL support, industry standard |
| Containerization | Docker + Docker Compose | Consistent environments from dev to production |
| Cloud deployment | Render (free tier) | Zero‑config CD from GitHub, managed Redis add‑on |
| CI/CD | GitHub Actions | Automated testing and Docker build on every push |
| Testing | pytest + FastAPI TestClient | Unit tests for logic, integration tests for endpoints |
| Frontend (optional) | Vanilla HTML/CSS/JS | Lightweight dashboard to visualize analytics |

---

## 🔧 Local Development
### Prerequisites
- Python 3.10+
- Docker Desktop (for Redis and full local stack)
- Git

### Steps
```bash
# 1. Clone repo
git clone https://github.com/YOUR_USERNAME/finsight.git
cd finsight

# 2. Create virtual environment & install dependencies
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Start Redis (if you have Docker)
docker run -d -p 6379:6379 redis:7-alpine

# 4. Run the API
uvicorn src.main:app --reload

# 5. Open in browser
http://127.0.0.1:8000/docs