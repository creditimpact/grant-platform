from fastapi import FastAPI, Request, HTTPException, Depends, Header
from engine import analyze_eligibility
from grants_loader import load_grants
import os

API_KEY = os.getenv("INTERNAL_API_KEY")


async def verify_api_key(x_api_key: str = Header(None)):
    if not API_KEY or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


app = FastAPI(title="Grant Eligibility Engine", dependencies=[Depends(verify_api_key)])


@app.get("/")
def root() -> dict[str, str]:
    """Health check route."""
    return {"status": "ok"}


@app.get("/status")
def status() -> dict[str, str]:
    """Alias health check."""
    return {"status": "ok"}

GRANTS = load_grants()


@app.post("/check")
async def check_eligibility(request: Request):
    """Check grant eligibility for provided user data."""
    try:
        data = await request.json()
        result = analyze_eligibility(data, explain=True)
        return result
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
    import uvicorn, ssl, os

    cert = os.getenv("TLS_CERT_PATH")
    key = os.getenv("TLS_KEY_PATH")
    ca = os.getenv("TLS_CA_PATH")
    kwargs: dict[str, object] = {"reload": True}
    if cert and key:
        kwargs.update({"ssl_certfile": cert, "ssl_keyfile": key})
        if ca:
            kwargs["ssl_ca_certs"] = ca
            kwargs["ssl_cert_reqs"] = ssl.CERT_REQUIRED
    uvicorn.run("api:app", host="0.0.0.0", port=4001, **kwargs)
