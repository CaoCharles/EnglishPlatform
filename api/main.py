"""
English Practice API - FastAPI Backend
"""
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routers import articles, health

# Load environment variables
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    print("🚀 English Practice API starting...")
    yield
    print("👋 English Practice API shutting down...")


# Create FastAPI app
app = FastAPI(
    title="English Practice API",
    description="Backend API for English conversation practice application",
    version="0.1.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(articles.router, prefix="/api", tags=["Articles"])

# Serve static files (frontend)
app.mount("/", StaticFiles(directory=".", html=True), name="static")
