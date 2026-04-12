from fastapi import APIRouter, HTTPException, Depends
from schemas.site import SiteScoreRequest, SiteScoreResponse, LayerWeights
from services.scoring_service import calculate_site_score
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/site", tags=["Site Orchestrator"])

@router.post("/score", response_model=SiteScoreResponse)
async def site_score(req: SiteScoreRequest):
    """
    POST /api/site/score
    
    Frontend behavior:
    The frontend calls this endpoint once when the user clicks a point on the map.
    The request includes lat, lng, use_case (from the selected tab), and optional weights
    (from the weight sliders the user has configured).
    
    The response powers:
      - A composite score badge (large number + label)
      - 5 horizontal progress bars (one per layer, colored by score)
      - An AI insight card showing the 3-sentence recommendation
      - A "weights used" section showing which factors were prioritized
      - A hard_cap_applied warning banner if zoning blocked the score
    """
    # Validate weights sum to 1.0 if provided
    weights_dict = None
    if req.weights:
        weights_dict = req.weights.dict()
        total_weight = sum(weights_dict.values())
        if abs(total_weight - 1.0) > 0.01:
            raise HTTPException(
                status_code=400, 
                detail=f"Provided weights must sum to 1.0. Current sum: {total_weight}"
            )
            
    try:
        result = await calculate_site_score(
            lat=req.lat, 
            lng=req.lng, 
            use_case=req.use_case,
            custom_weights=weights_dict
        )
        return result
    except Exception as e:
        logger.error(f"Error calculating composite site score: {e}")
        raise HTTPException(status_code=500, detail="Internal server error orchestrating layers")
