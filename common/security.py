from fastapi import Header, HTTPException, Request
from common.logger import get_logger
from types import SimpleNamespace

logger = get_logger(__name__)
BYPASS_PATHS = {"/healthz", "/readyz", "/metrics"}


def require_api_key(valid_keys: list[str], service: str):
    async def dependency(request: Request, x_api_key: str = Header(None)):
        method = getattr(request, "method", "GET")
        path = getattr(getattr(request, "url", None), "path", getattr(request, "path", ""))
        if method == "GET" and path in BYPASS_PATHS:
            return
        if x_api_key not in valid_keys:
            state = getattr(request, "state", SimpleNamespace())
            logger.warn(
                "auth_failed",
                {
                    "request_id": getattr(state, "request_id", None),
                    "service": service,
                    "path": path,
                    "method": method,
                    "remote_ip": request.client.host if getattr(request, "client", None) else None,
                },
            )
            raise HTTPException(status_code=401, detail="Unauthorized")
    return dependency
