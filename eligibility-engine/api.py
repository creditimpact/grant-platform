from fastapi import FastAPI, Request
from engine import analyze_eligibility

app = FastAPI()

@app.post("/check")
async def check_eligibility(request: Request):
    try:
        data = await request.json()
        result = analyze_eligibility(data)
        return {"eligible_grants": result}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=4001, reload=True)
