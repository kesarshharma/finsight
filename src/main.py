"""FinSight API entry point."""

from fastapi import FastAPI
from src.api.routes import router
from src.core.config import API_TITLE, API_VERSION, API_DESCRIPTION

app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    description=API_DESCRIPTION,
)

app.include_router(router)