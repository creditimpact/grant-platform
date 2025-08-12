import os
from importlib import import_module

try:  # hvac may not be installed in all environments
    hvac = import_module("hvac")
except Exception:  # pragma: no cover - handled at runtime
    hvac = None


def load_vault_secrets():
    """Load secrets from Vault and inject them into os.environ.

    Expects the following environment variables:
    - VAULT_ADDR: address of the Vault server
    - VAULT_TOKEN: authentication token
    - VAULT_SECRET_PATH: KV v2 path containing the secrets for the service

    If VAULT_TOKEN or VAULT_SECRET_PATH are missing the function is a no-op
    to maintain backwards compatibility for local development and tests.
    """
    addr = os.getenv("VAULT_ADDR", "http://127.0.0.1:8200")
    token = os.getenv("VAULT_TOKEN")
    secret_path = os.getenv("VAULT_SECRET_PATH")
    if not token or not secret_path:
        return {}

    if hvac is None:
        raise RuntimeError("hvac package is required for Vault integration")

    client = hvac.Client(url=addr, token=token)
    if not client.is_authenticated():
        raise RuntimeError("Failed to authenticate with Vault")

    secret_response = client.secrets.kv.v2.read_secret_version(path=secret_path)
    data = secret_response["data"]["data"]
    # update environment so existing configuration loaders can use it
    for k, v in data.items():
        os.environ.setdefault(k, str(v))
    return data
