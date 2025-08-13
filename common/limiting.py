import os
import time
import hashlib
import ipaddress
from fastapi import HTTPException, Request
from common.logger import get_logger

logger = get_logger(__name__)
EXEMPT_PATHS = {"/healthz", "/readyz", "/metrics"}
_hits = {}


def _hash(val: str) -> str:
    return hashlib.sha256(val.encode()).hexdigest()[:8]


def _identity(request: Request) -> tuple[str, str]:
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return "api_key", _hash(api_key)
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return "jwt", _hash(auth.split(None, 1)[1])
    host = getattr(request.client, "host", "")
    return "ip", host


def _whitelisted(request: Request, id_type: str, value: str) -> bool:
    entries = [w.strip() for w in os.getenv("RATE_LIMIT_WHITELIST", "").split(",") if w.strip()]
    ip = getattr(request.client, "host", "")
    if id_type == "ip":
        try:
            ip_addr = ipaddress.ip_address(ip)
            for item in entries:
                if "/" in item and ip_addr in ipaddress.ip_network(item, False):
                    return True
                if ip == item:
                    return True
        except ValueError:
            pass
    if request.headers.get("x-service-name") in entries:
        return True
    if value in entries:
        return True
    return False


def rate_limiter(service_name: str):
    enabled = os.getenv("ENABLE_RATE_LIMIT", "true").lower() == "true"
    limit = int(os.getenv("RATE_LIMIT_PER_MINUTE", "100"))
    window = int(os.getenv("RATE_LIMIT_WINDOW_SEC", "60"))

    def _dep(request: Request, _api_key: str | None = None):
        if not enabled or request.path in EXEMPT_PATHS:
            return
        id_type, ident = _identity(request)
        if _whitelisted(request, id_type, ident):
            return
        now = int(time.time())
        window_start = now - (now % window)
        key = f"{ident}:{window_start}"
        count = _hits.get(key, 0) + 1
        _hits[key] = count
        if count > limit:
            retry_after = window - (now - window_start)
            logger.warning(
                "rate_limited",
                extra={
                    "request_id": getattr(request, "state", {}).get("request_id", ""),
                    "service": service_name,
                    "path": request.path,
                    "method": getattr(request, "method", ""),
                    "remote_ip": getattr(request.client, "host", ""),
                    "identity_type": id_type,
                    "limit": limit,
                    "window_sec": window,
                },
            )
            raise HTTPException(status_code=429, detail={"error": "rate_limited", "retry_after": retry_after})
    return _dep
