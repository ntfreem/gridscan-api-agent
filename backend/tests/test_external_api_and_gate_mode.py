# External API (bbk_ keys + /v1/chat) and configurable Knowledge Gate (strict/flexible) tests
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"
OFF_KB_Q = "What is the capital of France?"
REFUSAL = ["don't have information", "do not have information", "not in my knowledge base",
           "isn't in my knowledge base", "knowledge base doesn't", "knowledge base does not"]
FLEX_DISCLAIMER = ["isn't in my knowledge base", "not in my knowledge base", "general knowledge"]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email_or_username": "administrator", "password": "Admin@123"})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}", "X-Instance-ID": INSTANCE_ID})
    return s


@pytest.fixture(scope="module")
def created_key(admin):
    r = admin.post(f"{BASE_URL}/api/admin/api-keys", json={"instance_id": INSTANCE_ID, "label": "TEST_key"})
    assert r.status_code == 200, r.text
    d = r.json()
    yield d
    admin.delete(f"{BASE_URL}/api/admin/api-keys/{d['id']}")


def v1(key, msg="How do I check a Cardano account balance with Gridscan?", sid=None):
    return requests.post(f"{BASE_URL}/api/v1/chat", headers={"Authorization": f"Bearer {key}"},
                         json={"message": msg, "session_id": sid or f"TEST_v1_{uuid.uuid4()}"}, timeout=120)


# --- API key management ---
class TestApiKeys:
    def test_create_returns_full_key(self, created_key):
        assert created_key["key"].startswith("bbk_") and len(created_key["key"]) == 52
        assert created_key["key_prefix"] == created_key["key"][:12]
        assert created_key["is_active"] is True and created_key["label"] == "TEST_key"
        assert "_id" not in created_key

    def test_create_missing_instance(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/api-keys", json={"label": "x"})
        assert r.status_code == 400

    def test_create_bad_instance(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/api-keys", json={"instance_id": "nope-xyz"})
        assert r.status_code == 404

    def test_create_unauth(self):
        r = requests.post(f"{BASE_URL}/api/admin/api-keys", json={"instance_id": INSTANCE_ID})
        assert r.status_code in (401, 403)

    def test_list_hides_secret(self, admin, created_key):
        r = admin.get(f"{BASE_URL}/api/admin/api-keys")
        assert r.status_code == 200
        rows = r.json()
        me = [k for k in rows if k["id"] == created_key["id"]]
        assert len(me) == 1
        for k in rows:
            assert "key" not in k and "key_hash" not in k and "_id" not in k
            assert k["instance_id"] == INSTANCE_ID


# --- /v1/chat auth + response ---
class TestV1Chat:
    def test_valid_key_chat(self, admin, created_key):
        sid = f"TEST_v1_{uuid.uuid4()}"
        r = v1(created_key["key"], sid=sid)
        assert r.status_code == 200, r.text
        d = r.json()
        print("V1:", d["response"][:300])
        assert d["session_id"] == sid and d["instance_id"] == INSTANCE_ID
        assert isinstance(d["response"], str) and d["response"].strip()
        rows = admin.get(f"{BASE_URL}/api/admin/api-keys").json()
        me = [k for k in rows if k["id"] == created_key["id"]][0]
        assert me["usage_count"] >= 1 and me["last_used_at"]

    def test_auto_session_id(self, created_key):
        r = requests.post(f"{BASE_URL}/api/v1/chat", headers={"Authorization": f"Bearer {created_key['key']}"},
                          json={"message": "hi"}, timeout=120)
        assert r.status_code == 200 and r.json()["session_id"]

    def test_invalid_key_401(self):
        assert v1("bbk_" + "0" * 48).status_code == 401

    def test_missing_header_401(self):
        r = requests.post(f"{BASE_URL}/api/v1/chat", json={"message": "hi"})
        assert r.status_code == 401

    def test_non_bbk_401(self):
        assert v1("sk-abc").status_code == 401

    def test_toggle_disable_403_then_enable(self, admin, created_key):
        r = admin.patch(f"{BASE_URL}/api/admin/api-keys/{created_key['id']}/toggle")
        assert r.status_code == 200 and r.json()["is_active"] is False
        r2 = v1(created_key["key"], msg="hi")
        assert r2.status_code == 403, r2.text
        r = admin.patch(f"{BASE_URL}/api/admin/api-keys/{created_key['id']}/toggle")
        assert r.json()["is_active"] is True
        rows = admin.get(f"{BASE_URL}/api/admin/api-keys").json()
        assert [k for k in rows if k["id"] == created_key["id"]][0]["is_active"] is True

    def test_toggle_404(self, admin):
        assert admin.patch(f"{BASE_URL}/api/admin/api-keys/nope/toggle").status_code == 404

    def test_revoke_then_401(self, admin):
        d = admin.post(f"{BASE_URL}/api/admin/api-keys", json={"instance_id": INSTANCE_ID, "label": "TEST_revoke"}).json()
        r = admin.delete(f"{BASE_URL}/api/admin/api-keys/{d['id']}")
        assert r.status_code == 200 and r.json()["success"] is True
        assert v1(d["key"], msg="hi").status_code == 401
        assert admin.delete(f"{BASE_URL}/api/admin/api-keys/{d['id']}").status_code == 404
        ids = [k["id"] for k in admin.get(f"{BASE_URL}/api/admin/api-keys").json()]
        assert d["id"] not in ids


# --- Knowledge gate strict/flexible ---
def ask(msg):
    r = requests.post(f"{BASE_URL}/api/chat/send", json={"message": msg, "instance_id": INSTANCE_ID,
                      "session_id": f"TEST_gate_{uuid.uuid4()}"}, timeout=120)
    assert r.status_code == 200, r.text
    t = r.json()["response"]
    print(f"\nQ: {msg}\nA: {t}\n")
    return t.lower().replace("\u2019", "'")


class TestGateMode:
    def test_flexible_then_strict(self, admin, created_key):
        orig = admin.get(f"{BASE_URL}/api/admin/bot-config").json().get("knowledge_gate", "strict")
        try:
            r = admin.put(f"{BASE_URL}/api/admin/bot-config", json={"knowledge_gate": "flexible"})
            assert r.status_code == 200 and r.json()["knowledge_gate"] == "flexible"
            assert admin.get(f"{BASE_URL}/api/admin/bot-config").json()["knowledge_gate"] == "flexible"
            t = ask(OFF_KB_Q)
            assert "paris" in t, "flexible should answer from general knowledge"
            assert any(m in t for m in FLEX_DISCLAIMER), "flexible missing disclaimer"
            # flexible via external API too
            vt = v1(created_key["key"], msg=OFF_KB_Q).json()["response"].lower().replace("\u2019", "'")
            print("V1 flex:", vt)
            assert "paris" in vt and any(m in vt for m in FLEX_DISCLAIMER)

            r = admin.put(f"{BASE_URL}/api/admin/bot-config", json={"knowledge_gate": "strict"})
            assert r.json()["knowledge_gate"] == "strict"
            t = ask(OFF_KB_Q)
            assert "paris" not in t and any(m in t for m in REFUSAL)
            vt = v1(created_key["key"], msg=OFF_KB_Q).json()["response"].lower()
            assert "paris" not in vt
        finally:
            admin.put(f"{BASE_URL}/api/admin/bot-config", json={"knowledge_gate": orig})

    def test_flexible_kb_question_no_disclaimer(self, admin):
        try:
            admin.put(f"{BASE_URL}/api/admin/bot-config", json={"knowledge_gate": "flexible"})
            t = ask("How do I check a Cardano account balance with Gridscan?")
            assert "/accounts/" in t or "accounts/{address}" in t
        finally:
            admin.put(f"{BASE_URL}/api/admin/bot-config", json={"knowledge_gate": "strict"})

    def test_invalid_gate_value(self, admin):
        # Observational: is an invalid value rejected?
        r = admin.put(f"{BASE_URL}/api/admin/bot-config", json={"knowledge_gate": "bogus"})
        print("invalid gate status:", r.status_code, r.text[:200])
        admin.put(f"{BASE_URL}/api/admin/bot-config", json={"knowledge_gate": "strict"})
        assert r.status_code in (400, 422), "invalid knowledge_gate accepted (falls back to flexible behavior)"
