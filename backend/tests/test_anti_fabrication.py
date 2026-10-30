# Anti-fabrication regression: live API query vs LLM role-playing fake API calls (/api/chat/send)
# NOTE: does NOT modify api_key_value. Only toggles api_query_enabled (restored in teardown).
import os
import re
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"
MARKER = "Live data from"
TX = "ad9daf9aab70de3c5d0fffca96726a8f00aefe137a044282d9e10daf03c870cd"
FAB_PATTERNS = [r"Calling:\s*GET", r"Calling:\s*`?GET", r"Response:\s*```json", r"\bHTTP/1\.1 200\b"]


def chat(msg, retries=1):
    last = None
    for _ in range(retries + 1):
        r = requests.post(f"{BASE_URL}/api/chat/send",
                          json={"message": msg, "instance_id": INSTANCE_ID,
                                "session_id": f"TEST_fab_{int(time.time())}_{uuid.uuid4().hex[:6]}"},
                          timeout=180)
        last = r
        if r.status_code == 200:
            return r.json()["response"]
    assert last.status_code == 200, last.text
    return last.json()["response"]


def assert_no_fabrication(resp):
    for p in FAB_PATTERNS:
        assert not re.search(p, resp, re.I), f"Fabrication pattern {p!r} found:\n{resp[:1500]}"


def has_json_block(resp):
    return bool(re.search(r"```json", resp, re.I)) or bool(re.search(r'\{\s*"[a-z_]+"\s*:', resp))


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email_or_username": "administrator", "password": "Admin@123"})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}", "X-Instance-ID": INSTANCE_ID})
    yield s
    s.put(f"{BASE_URL}/api/admin/bot-config", json={"api_query_enabled": True})


class TestLiveQueries:
    def test_health_unauth(self):
        r = requests.get("https://ada.api.gridscan.io/api/health", timeout=20)
        print("gridscan health:", r.status_code, r.text[:200])

    def test_transaction_real_data(self):
        resp = chat(f"Query transaction {TX}")
        print("TX:", resp[:2000])
        assert MARKER in resp
        assert_no_fabrication(resp)
        nums = [int(n.replace(",", "")) for n in re.findall(r"\b\d{1,2},?\d{3},?\d{3}\b", resp)]
        assert any(14_000_000 <= n <= 15_000_000 for n in nums), f"No ~14.1M block height found: {nums}"

    def test_health_live(self):
        resp = chat("Check the API health status")
        print("HEALTH:", resp[:1500])
        assert MARKER in resp and "/api/health" in resp
        assert_no_fabrication(resp)

    def test_invalid_stake_graceful(self):
        resp = chat("Make an API call to get balance of stake1uxyz123invalid")
        print("INVALID:", resp[:1500])
        assert_no_fabrication(resp)
        assert MARKER not in resp
        assert not has_json_block(resp), "Fake JSON in response for invalid stake"
        assert ("HTTP 404" in resp or "error" in resp.lower() or "wasn't able" in resp.lower()
                or "not" in resp.lower())

    def test_doc_question_no_api(self):
        resp = chat("What endpoints exist for accounts?")
        print("DOC:", resp[:1500])
        assert MARKER not in resp
        assert "I tried to query" not in resp
        assert_no_fabrication(resp)


class TestFallbackNoApi:
    """With api_query_enabled=false (router path skipped), bot must not role-play an API call."""

    def test_disabled_no_fabrication(self, admin):
        r = admin.put(f"{BASE_URL}/api/admin/bot-config", json={"api_query_enabled": False})
        assert r.status_code == 200
        try:
            resp = chat(f"Query transaction {TX} and show me the JSON response")
            print("DISABLED TX:", resp[:2000])
            assert MARKER not in resp
            assert_no_fabrication(resp)
            assert not re.search(r"block[_ ]?(height|no|number)\D{0,10}14,?1\d{2},?\d{3}", resp, re.I), \
                "Made-up block height"
            assert not re.search(r"I (can|have the ability to) (query|call) (the )?API", resp, re.I)
        finally:
            r2 = admin.put(f"{BASE_URL}/api/admin/bot-config", json={"api_query_enabled": True})
            assert r2.status_code == 200
            assert admin.get(f"{BASE_URL}/api/admin/bot-config").json().get("api_key_value_set") is True
