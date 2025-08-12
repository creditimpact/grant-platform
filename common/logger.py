import logging
import json
import os
import re
import hashlib
from typing import Any, Dict

SENSITIVE_FIELDS = {"password", "token", "api_key", "ssn", "email", "name", "address", "ip", "phone"}
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")

def _anonymize_ip(ip: str) -> str:
    return hashlib.sha256(ip.encode()).hexdigest()[:8]

def _redact_value(key: str, value: Any) -> Any:
    if key in SENSITIVE_FIELDS:
        if key == "ip" and isinstance(value, str):
            return _anonymize_ip(value)
        return "[REDACTED]"
    if isinstance(value, str):
        if IP_RE.search(value):
            return _anonymize_ip(value)
        if EMAIL_RE.search(value):
            return "[REDACTED]"
    return _redact(value)

def _redact(value: Any) -> Any:
    """Recursively redact sensitive fields from dictionaries."""
    if isinstance(value, dict):
        return {k: _redact_value(k, v) for k, v in value.items()}
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
        level = os.getenv("LOG_LEVEL", "INFO")
        if os.getenv("ENVIRONMENT") == "production" and level == "INFO":
            level = "WARNING"
        logger.setLevel(level)
        # Allow log records to propagate so tests can capture them via caplog
        logger.propagate = True
    return logger

def audit_log(logger: logging.Logger, action: str, **details: Any) -> None:
    """Emit an audit log entry for security-critical events."""
    logger.info(action, extra={"audit": True, **_redact(details)})
