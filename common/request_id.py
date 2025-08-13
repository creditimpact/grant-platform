import uuid
from starlette.requests import Request

async def request_id_middleware(request: Request, call_next):
    req_id = request.headers.get('X-Request-Id') or str(uuid.uuid4())
    request.state.request_id = req_id
    response = await call_next(request)
    response.headers['X-Request-Id'] = req_id
    return response
