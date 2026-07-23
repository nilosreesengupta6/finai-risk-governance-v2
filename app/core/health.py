"""
Health check endpoint for container orchestration.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ai-cost-intelligence-gateway",
        "version": "2.0.0",
    }
