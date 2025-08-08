import logging
import json
import os
from typing import Any, Dict

SENSITIVE_FIELDS = {"password", "token", "api_key", "ssn"}

def _redact(value: Any) -> Any:
    """Recursively redact sensitive fields from dictionaries."""
    if isinstance(value, dict):
        return {k: ("[REDACTED]" if k in SENSITIVE_FIELDS else _redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact(v) for v in value]
    return value

class JsonFormatter(logging.Formatter):
    """Format logs as JSON with timestamp and level."""

    def format(self, record: logging.LogRecord) -> str:
        log_record: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "name": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in {
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "exc_info",
                "exc_text",
                "stack_info",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
            }:
                log_record[key] = _redact(value)
        return json.dumps(log_record)

def get_logger(name: str) -> logging.Logger:
    """Return a module-level logger with JSON formatting."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))
        logger.propagate = False
    return logger

def audit_log(logger: logging.Logger, action: str, **details: Any) -> None:
    """Emit an audit log entry for security-critical events."""
    logger.info(action, extra={"audit": True, **_redact(details)})
