import os
import hvac

def get_secret(secret_path, secret_key):
    vault_addr = os.getenv("VAULT_ADDR", "http://127.0.0.1:8200")
    vault_token = os.getenv("VAULT_TOKEN")

    if not vault_token:
        raise Exception("VAULT_TOKEN is not set in environment variables")

    client = hvac.Client(url=vault_addr, token=vault_token)

    if not client.is_authenticated():
        raise Exception("Failed to authenticate with Vault")

    secret_response = client.secrets.kv.v2.read_secret_version(path=secret_path)

    return secret_response['data']['data'][secret_key]
