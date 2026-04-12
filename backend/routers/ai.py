from fastapi import APIRouter, HTTPException
from schemas.ai import CompareSitesRequest, CompareSitesResponse
from services.ai_service import compare_sites

router = APIRouter(prefix="/api/ai", tags=["AI Analysis"])

@router.post("/compare", response_model=CompareSitesResponse)
async def analyze_and_compare_sites(request: CompareSitesRequest):
    """
    Analyzes multiple sites and recommends the best one based on the user's needs
    using Groq's LLM API.
    """
    try:
        response = await compare_sites(request)
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
