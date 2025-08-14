import uuid
from contextvars import ContextVar
from starlette.requests import Request
from common.logger import get_logger

_request_id_ctx = ContextVar("request_id", default=None)
logger = get_logger(__name__)


async def request_id_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    request.state.request_id = req_id
    _request_id_ctx.set(req_id)
    response = await call_next(request)
    response.headers["X-Request-Id"] = req_id
    logger.info(
        "request",
        extra={
            "request_id": req_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
        },
    )
    return response


def get_request_id():
    return _request_id_ctx.get()


def inject_request_id(headers: dict | None = None) -> dict:
    """Attach the current request id to outbound request headers."""
    headers = dict(headers or {})
    req_id = get_request_id()
    if req_id:
        headers.setdefault("X-Request-Id", req_id)
    return headers
