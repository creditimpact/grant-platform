import asyncio
from typing import Any, Callable, Dict


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail

import asyncio
from typing import Any, Dict, Callable
from types import SimpleNamespace


class UploadFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._content = content

    async def read(self) -> bytes:
        return self._content


class Request:
    def __init__(self, json_data: Any = None, headers: Dict[str, str] | None = None):
        self._json = json_data or {}
        self.headers = headers or {}
        self.client = SimpleNamespace(host="test")
        self.query_params: Dict[str, Any] = {}

    async def json(self) -> Any:
        return self._json


def File(default=None):
    return default


def Form(default=None):
    return default


def Body(default=None, *, example=None):
    return default


def Header(default=None):
    return default


def Depends(func):
    return func


class FastAPI:
    def __init__(self, title: str | None = None, **kwargs):
        self.routes: Dict[str, Callable] = {}
        self.dependencies = [d for d in kwargs.get("dependencies", [])]

    def post(self, path: str, **kwargs):
        def decorator(func: Callable):
            self.routes[path] = func
            return func

        return decorator

    def get(self, path: str, **kwargs):
        return self.post(path, **kwargs)


class Response:
    def __init__(self, json_data: Any):
        self._json = json_data
        self.status_code = 200

    def json(self) -> Any:
        return self._json


class TestClient:
    def __init__(self, app: FastAPI):
        self.app = app

    def post(self, path: str, json: Dict | None = None, files: Dict | None = None, data: Dict | None = None):
        headers = {"content-type": "application/json"} if json else {"content-type": "multipart/form-data"}
        request = Request(json_data=json, headers=headers)
        request.path = path
        request.method = "POST"
        file = None
        if files:
            _name, (filename, file_obj, _type) = next(iter(files.items()))
            file = UploadFile(filename, file_obj.read())
        try:
            for dep in getattr(self.app, "dependencies", []):
                if asyncio.iscoroutinefunction(dep):
                    asyncio.run(dep(request, request.headers.get("X-API-Key")))
                else:
                    dep(request, request.headers.get("X-API-Key"))
            coro = self.app.routes[path](request, file=file, data=data)
            result = asyncio.run(coro)
            return Response(result)
        except HTTPException as exc:
            resp = Response({"detail": exc.detail})
            resp.status_code = exc.status_code
            return resp

    def get(self, path: str, headers: Dict[str, str] | None = None):
        request = Request(headers=headers)
        request.path = path
        request.method = "GET"
        handler = self.app.routes[path]
        try:
            for dep in getattr(self.app, "dependencies", []):
                if asyncio.iscoroutinefunction(dep):
                    asyncio.run(dep(request, request.headers.get("X-API-Key")))
                else:
                    dep(request, request.headers.get("X-API-Key"))
            if asyncio.iscoroutinefunction(handler):
                result = asyncio.run(handler(request))
            else:
                try:
                    result = handler(request)
                except TypeError:
                    result = handler()
            return Response(result)
        except HTTPException as exc:
            resp = Response({"detail": exc.detail})
            resp.status_code = exc.status_code
            return resp
