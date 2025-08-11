import os
from importlib import reload
import api
from fastapi.testclient import TestClient


def reload_app():
    reload(api)
    return TestClient(api.app)


def test_metrics_disabled():
    os.environ.pop('OBSERVABILITY_ENABLED', None)
    os.environ.pop('PROMETHEUS_METRICS_ENABLED', None)
    client = reload_app()
    res = client.get('/metrics')
    assert res.status_code == 404


def test_metrics_enabled():
    os.environ['OBSERVABILITY_ENABLED'] = 'true'
    os.environ['PROMETHEUS_METRICS_ENABLED'] = 'true'
    client = reload_app()
    res = client.get('/metrics')
    assert res.status_code == 200


def test_request_id_header():
    os.environ['REQUEST_ID_ENABLED'] = 'true'
    os.environ['REQUEST_LOG_JSON'] = 'true'
    client = reload_app()
    res = client.get('/', headers={'X-Request-Id': 'req-1'})
    assert res.headers['X-Request-Id'] == 'req-1'
