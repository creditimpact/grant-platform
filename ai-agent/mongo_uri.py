from __future__ import annotations

from typing import Optional
from urllib.parse import urlsplit, urlunsplit, quote
from pathlib import Path
import sys

PARENT = Path(__file__).resolve().parent.parent
if str(PARENT) not in sys.path:
    sys.path.insert(0, str(PARENT))

from common.logger import get_logger

logger = get_logger(__name__)


def _mask(uri: str) -> str:
    """Return a URI with credentials masked for logging."""
    parts = urlsplit(uri)
    netloc = parts.netloc
    if "@" in netloc:
        _creds, host = netloc.split("@", 1)
        netloc = f"<hidden>@{host}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def build_mongo_uri(uri: str, user: Optional[str], pwd: Optional[str]) -> str:
    """Construct a MongoDB URI, injecting credentials when needed.

    If both ``user`` and ``pwd`` are provided and the ``uri`` lacks credentials,
    they are URL-encoded and inserted. If the ``uri`` already contains
    credentials or only one of ``user``/``pwd`` is provided, the ``uri`` is
    returned unchanged. A debug log is emitted with credentials masked. When
    partial credentials are supplied a warning is logged.
    """

    parts = urlsplit(uri)

    if user and pwd and "@" not in parts.netloc:
        userinfo = f"{quote(user)}:{quote(pwd)}@"
        netloc = userinfo + parts.netloc
        uri = urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
    elif (user and not pwd) or (pwd and not user):
        logger.warning("Partial Mongo credentials provided; ignoring")

    logger.debug("Connecting to MongoDB at %s", _mask(uri))
    return uri
