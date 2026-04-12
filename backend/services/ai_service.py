import os
from groq import AsyncGroq
from schemas.ai import CompareSitesRequest, CompareSitesResponse

# Initialize the Groq client. It requires the GROQ_API_KEY environment variable.
# We will use AsyncGroq for async operations.
client = AsyncGroq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

async def compare_sites(request: CompareSitesRequest) -> CompareSitesResponse:
    if not client.api_key:
        raise ValueError("GROQ_API_KEY environment variable is not set. Please add it to your .env file.")

    system_prompt = (
        "You are an expert geospatial analyst and commercial real estate advisor. "
        "You will be given data about multiple potential sites for a specific use case. "
        "Each site includes a breakdown of its scores (Overall, Demographics, Transportation, Competition, Land Use, Environmental Risk) "
        "along with the raw layer data that contributed to these scores.\n\n"
        "Your task is to analyze these sites, compare them based on the provided use case and user needs, "
        "and recommend the most suitable site. Provide a detailed rationale for your recommendation, highlighting the key strengths "
        "and potential weaknesses of each option."
    )

    sites_info = ""
    for site in request.sites:
        sites_info += f"--- Site {site.id} ({site.name}) ---\n"
        sites_info += f"Coordinates: {site.lat}, {site.lng}\n"
        sites_info += "Scores:\n"
        sites_info += f"  Overall: {site.scores.overall}\n"
        sites_info += f"  Demographics: {site.scores.demographics}\n"
        sites_info += f"  Transportation: {site.scores.transportation}\n"
        sites_info += f"  Competition: {site.scores.competition}\n"
        sites_info += f"  Land Use: {site.scores.landuse}\n"
        sites_info += f"  Risk: {site.scores.risk}\n"
        sites_info += f"Detailed Layer Data: {site.layer_data}\n\n"

    user_prompt = f"Use Case: {request.use_case}\n\n"
    if request.user_need:
        user_prompt += f"Specific User Needs/Context: {request.user_need}\n\n"
    user_prompt += "Here is the data for the potential sites:\n\n"
    user_prompt += sites_info
    
    user_prompt += "\nPlease provide a comprehensive analysis comparing these sites. End your response by clearly identifying the ID of the best site in the format: 'RECOMMENDED_SITE_ID: <id>'."

    try:
        chat_completion = await client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                }
            ],
            model="llama-3.3-70b-versatile", # using a standard large model
            temperature=0.3,
            max_tokens=2048,
        )

        response_text = chat_completion.choices[0].message.content
        
        # Extract recommended site ID
        recommended_id = ""
        for line in response_text.split('\n'):
            if "RECOMMENDED_SITE_ID:" in line:
                recommended_id = line.split("RECOMMENDED_SITE_ID:")[1].strip().strip('*').strip()
                break
        
        # If it couldn't be parsed, perhaps just return the best effort
        if not recommended_id and request.sites:
            recommended_id = request.sites[0].id # fallback

        return CompareSitesResponse(
            analysis=response_text,
            recommended_site_id=recommended_id
        )
    except Exception as e:
        # Wrap exception for HTTP mapping later
        raise Exception(f"AI Analysis failed: {str(e)}")
