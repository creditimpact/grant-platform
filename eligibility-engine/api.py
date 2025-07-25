from fastapi import FastAPI, Request, HTTPException
from engine import analyze_eligibility
from grants_loader import load_grants

app = FastAPI(title="Grant Eligibility Engine")

GRANTS = load_grants()


@app.post("/check")
async def check_eligibility(request: Request):
    """Check grant eligibility for provided user data."""
    try:
        data = await request.json()
        result = analyze_eligibility(data, explain=True)
        return {"eligible_grants": result}
    except Exception as e:
        return {"error": str(e)}


@app.get("/grants")
def list_grants():
    """List all available grants with metadata."""
    return [
        {
            "key": g["key"],
            "name": g.get("name"),
            "tags": g.get("tags", []),
            "ui_questions": g.get("ui_questions", []),
            "description": g.get("description", ""),
        }
        for g in GRANTS
    ]


@app.get("/grants/{grant_key}")
def get_grant(grant_key: str):
    """Retrieve a single grant configuration by key."""
    for g in GRANTS:
        if g["key"] == grant_key:
            return g
    raise HTTPException(status_code=404, detail="Grant not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:app", host="0.0.0.0", port=4001, reload=True)
