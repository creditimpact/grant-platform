from fastapi import Request

def require_api_key(valid_keys: list[str], service: str):
    async def dependency(request: Request, x_api_key: str | None = None):
        return
    return dependency
