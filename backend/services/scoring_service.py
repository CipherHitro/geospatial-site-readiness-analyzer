import os
from dotenv import load_dotenv
load_dotenv()
import time
import asyncio
import httpx
import logging
from typing import Dict, Any, Tuple, Optional
from collections import Counter
from groq import AsyncGroq

logger = logging.getLogger(__name__)

DEFAULT_WEIGHTS = {
    "retail":      {"demographics": 0.30, "transport": 0.20, "poi": 0.25, "zoning": 0.15, "environment": 0.10},
    "ev_charging": {"demographics": 0.20, "transport": 0.35, "poi": 0.15, "zoning": 0.20, "environment": 0.10},
    "warehouse":   {"demographics": 0.10, "transport": 0.35, "poi": 0.10, "zoning": 0.30, "environment": 0.15},
    "telecom":     {"demographics": 0.20, "transport": 0.25, "poi": 0.10, "zoning": 0.25, "environment": 0.20},
    "energy":      {"demographics": 0.10, "transport": 0.20, "poi": 0.10, "zoning": 0.35, "environment": 0.25},
}

def get_base_url() -> str:
    # Use localhost:8000 for internal API calls since the server hosts them.
    return "http://localhost:8000"

def get_label(score: float) -> str:
    if score >= 80: return "Excellent"
    if score >= 65: return "Good"
    if score >= 50: return "Moderate"
    if score >= 35: return "Poor"
    return "Not Recommended"

async def fetch_layer(client: httpx.AsyncClient, endpoint: str, payload: dict, layer_name: str) -> Tuple[str, dict, float, Optional[str]]:
    try:
        url = f"{get_base_url()}{endpoint}"
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        
        # Determine the key to fetch the specific score
        score_key = f"{layer_name}_score"
        score = float(data.get(score_key, 0.0))
        return layer_name, data, score, None
    except Exception as e:
        logger.error(f"Error fetching {layer_name} layer: {e}")
        return layer_name, {}, 0.0, f"Failed to fetch {layer_name} layer"

def get_dominant_income(people_grouping: dict) -> str:
    if not people_grouping:
        return "Unknown"
    return max(people_grouping.items(), key=lambda k: k[1])[0]

async def get_ai_insight(composite_score: float, score_label: str, use_case: str, lat: float, lng: float, layers_data: dict, scores: dict) -> str:
    try:
        client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY", ""))
        
        demo = layers_data.get("demographics", {})
        trans = layers_data.get("transport", {})
        poi = layers_data.get("poi", {})
        zone = layers_data.get("zoning", {})
        env = layers_data.get("environment", {})
        
        dom_income = get_dominant_income(demo.get("people_grouping", {}))
        
        # Build use-case specific context highlighting
        uc_highlights = ""
        if use_case == "retail":
            uc_highlights = f"Focus on high population ({demo.get('population')}) and proximity to anchors ({poi.get('anchor_count')})."
        elif use_case == "ev_charging":
            uc_highlights = f"Focus on road availability ({trans.get('total_road_length_m')}m) and gaps in existing stations."
        elif use_case == "warehouse":
            uc_highlights = f"Focus on zoning area ({zone.get('total_built_area_sqm')} sqm) and commercial clearance."
        elif use_case == "energy":
            uc_highlights = f"Focus on environmental safety (AQI: {env.get('aqi')}) and zoning suitability."
        elif use_case == "telecom":
            uc_highlights = f"Focus on residential reach and road connectivity."

        prompt = f"""
Use case: {use_case}
Location: ({lat}, {lng}), Ahmedabad, India
Strategic Priority: {uc_highlights}

Detailed Metrics:
1. Demographics: {scores.get('demographics', 0)}/100
   - Density: {demo.get('population', 0)} people in H3 cell
   - Economy: {dom_income} dominant income, Wealth Index: {demo.get('relative_wealth_index', 'N/A')}
2. Transport: {scores.get('transport', 0)}/100
   - Connectivity: {trans.get('total_road_length_m', 0)}m road length nearby
   - Gaps: Closest station is {trans.get('station_distance_m', 'N/A')}m away
3. POI & Ecosystem: {scores.get('poi', 0)}/100
   - Market: {poi.get('competitor_count', 0)} competitors vs {poi.get('anchor_count', 0)} major anchors
4. Zoning & Site: {scores.get('zoning', 0)}/100
   - Legal: Zone {zone.get('zone_type', 'Unknown')}
   - Scale: {zone.get('total_built_area_sqm', 0)} sqm total built area in vicinity
5. Risk: {scores.get('environment', 0)}/100
   - Environment: AQI {env.get('aqi', 'N/A')} ({env.get('aqi_level', 'Unknown')}), Flood Raw Score: {env.get('flood_score_raw', 0)}

Assessment: {score_label} (Overall {round(composite_score, 1)}/100)

Assessment: {score_label} (Overall {round(composite_score, 1)}/100)

Task: Provide a structured analysis using EXACTLY these bullet points (no paragraphs):
- ✅ **[Selection Drivers]**: List 2 specific data-driven reasons to select this site for {use_case}.
- ⚠️ **[Risk Factors]**: List 1-2 critical data-driven concerns OR reasons for potential rejection.
- 💡 **[Action Plan]**: One concrete, site-specific recommendation for the business owner.

DO NOT be generic. Cite the numbers provided above. Keep each bullet point under 25 words.
"""

        chat_completion = await client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior Geospatial Site Strategist for the Ahmedabad market. You provide sharp, data-first recommendations formatted as bullet points. Use emojis for impact. Never write paragraphs. Keep responses under 200 characters per bullet."
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.1-8b-instant",
            temperature=0.2,
            max_tokens=180,
            timeout=15.0
        )
        return chat_completion.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Groq LLM call failed: {e}")
        return "AI insight unavailable — please retry."

async def calculate_site_score(lat: float, lng: float, use_case: str, custom_weights: dict = None) -> dict:
    start_time = time.time()
    
    use_case = use_case.lower()
    weights = custom_weights or DEFAULT_WEIGHTS.get(use_case, DEFAULT_WEIGHTS["retail"])
    
    payload = {"lat": lat, "lng": lng, "use_case": use_case}
    
    endpoints = [
        ("/api/demographics/score", "demographics"),
        ("/api/transport/score", "transport"),
        ("/api/poi/score", "poi"),
        ("/api/zoning/score", "zoning"),
        ("/api/environment/score", "environment")
    ]
    
    layers_data = {}
    scores = {}
    warnings = []
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = [fetch_layer(client, ep, payload, name) for ep, name in endpoints]
        results = await asyncio.gather(*tasks)
        
        for name, data, score, err in results:
            layers_data[name] = data
            scores[name] = score
            if err:
                warnings.append(err)
                
    # Calculate composite score
    composite = sum(scores[name] * weights.get(name, 0) for name in scores)
    
    # Hard cap based on zoning (only for explicit Restricted zones now)
    zoning_details = layers_data.get("zoning", {})
    hard_cap_applied = False
    
    if zoning_details and zoning_details.get("zone_type") == "restricted":
        if composite > 25:
            composite = 25
            hard_cap_applied = True
            
    score_label = get_label(composite)
    
    # Call AI insight
    ai_insight = await get_ai_insight(composite, score_label, use_case, lat, lng, layers_data, scores)
    
    elapsed_ms = (time.time() - start_time) * 1000
    
    logger.info(f"SiteScoreRequest | lat={lat:.4f}, lng={lng:.4f}, use_case={use_case}, composite={composite:.1f}, time={elapsed_ms:.1f}ms")
    
    return {
        "composite_score": round(composite, 1),
        "score_label": score_label,
        "use_case": use_case,
        "lat": lat,
        "lng": lng,
        "layer_scores": scores,
        "layer_details": layers_data,
        "weights_used": weights,
        "ai_insight": ai_insight,
        "hard_cap_applied": hard_cap_applied,
        "warnings": warnings,
        "response_time_ms": round(elapsed_ms, 2)
    }
