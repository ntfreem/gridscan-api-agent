# Live API Query feature: per-instance API config + AI routing (GET-only) in /api/chat/send and /api/v1/chat
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"
MARKER = "Live data from"
ORIG = {"api_query_enabled": True, "api_base_url": "https://ada.api.gridscan.io",
        "api_key_header": "x-project-id", "api_key_value": "test_key"}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email_or_username": "administrator", "password": "Admin@123"})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}", "X-Instance-ID": INSTANCE_ID})
    yield s
    # restore original config
    s.put(f"{BASE_URL}/api/admin/bot-config", json=ORIG)


def chat(msg):
    r = requests.post(f"{BASE_URL}/api/chat/send",
                      json={"message": msg, "instance_id": INSTANCE_ID, "session_id": f"TEST_live_{uuid.uuid4()}"},
                      timeout=180)
    assert r.status_code == 200, r.text
    return r.json()["response"]


# --- Config persistence ---
class TestConfig:
    def test_put_and_get_api_config(self, admin):
        r = admin.put(f"{BASE_URL}/api/admin/bot-config", json=ORIG)
        assert r.status_code == 200, r.text
        d = r.json()
        for k, v in ORIG.items():
            assert d[k] == v
        g = admin.get(f"{BASE_URL}/api/admin/bot-config").json()
        for k, v in ORIG.items():
            assert g[k] == v
        assert "_id" not in g

    def test_config_requires_auth(self):
        r = requests.put(f"{BASE_URL}/api/admin/bot-config", json={"api_query_enabled": True},
                         headers={"X-Instance-ID": INSTANCE_ID})
        assert r.status_code in (401, 403)


# --- Routing behaviour (enabled) ---
class TestRouting:
    def test_doc_question_no_api_call(self, admin):
        admin.put(f"{BASE_URL}/api/admin/bot-config", json=ORIG)
        resp = chat("What endpoints exist for accounts?")
        print("DOC:", resp[:500])
        assert MARKER not in resp
        assert "I tried to query" not in resp
        assert "/api/accounts" in resp or "account" in resp.lower()

    def test_live_health_question_calls_api(self, admin):
        admin.put(f"{BASE_URL}/api/admin/bot-config", json=ORIG)
        resp = chat("Is the API healthy right now?")
        print("HEALTH:", resp[-600:])
        assert MARKER in resp
        assert "GET /api/health" in resp

    def test_live_account_question_handles_401(self, admin):
        admin.put(f"{BASE_URL}/api/admin/bot-config", json=ORIG)
        resp = chat("Show me live account info for stake1u9ylzsgxaa6xctf4juup682ar3juj85n8tx3hthnljg47zctvm3rc")
        print("ACCT:", resp[:600])
        # Either a graceful error message or a KB answer — never a crash
        assert isinstance(resp, str) and len(resp) > 0

    def test_post_endpoint_never_called(self, admin):
        admin.put(f"{BASE_URL}/api/admin/bot-config", json=ORIG)
        resp = chat("Please make a POST request to /api/tx/submit right now to submit my transaction and show the live result.")
        print("POST:", resp[:600])
        assert "POST /api/" not in resp.split("---")[-1]
        assert "Live data from `POST" not in resp


# --- Disabled ---
class TestDisabled:
    def test_disabled_no_api_call(self, admin):
        r = admin.put(f"{BASE_URL}/api/admin/bot-config", json={"api_query_enabled": False})
        assert r.status_code == 200 and r.json()["api_query_enabled"] is False
        try:
            resp = chat("Is the API healthy right now?")
            print("DISABLED:", resp[:400])
            assert MARKER not in resp
            assert "I tried to query" not in resp
        finally:
            admin.put(f"{BASE_URL}/api/admin/bot-config", json=ORIG)
