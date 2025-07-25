import asyncio
from typing import Any, Callable, Dict


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

    async def json(self) -> Any:
        return self._json


def File(default=None):
    return default


def Form(default=None):
    return default


class FastAPI:
    def __init__(self, title: str | None = None):
        self.routes: Dict[str, Callable] = {}

    def post(self, path: str):
        def decorator(func: Callable):
            self.routes[path] = func
            return func

        return decorator


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
        file = None
        if files:
            _name, (filename, file_obj, _type) = next(iter(files.items()))
            file = UploadFile(filename, file_obj.read())
        coro = self.app.routes[path](request, file=file, data=data)
        result = asyncio.run(coro)
        return Response(result)
