from fastapi import Request

def rate_limiter(service_name: str):
    def _dep(request: Request, _api_key: str | None = None):
        return
    return _dep
