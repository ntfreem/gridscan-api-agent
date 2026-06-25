"""HTTP/curl tests for the new scripted-counters/count and scripted-mode/sandbox endpoints."""
import os
import sys
import uuid
import asyncio
import pytest
import requests
from datetime import datetime, timezone, timedelta

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
import server  # noqa: E402

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://futurism-chat-ui.preview.emergentagent.com").rstrip("/")
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD,
    }, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:300]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def instance_id(auth_token):
    r = requests.get(
        f"{BASE_URL}/api/admin/instances",
        headers={"Authorization": f"Bearer {auth_token}"}, timeout=20,
    )
    assert r.status_code == 200
    instances = r.json()
    assert instances, "no instances available"
    # Prefer the Scripted Test instance if present
    for inst in instances:
        if inst.get("id") == "8292460c-de40-4a28-a711-640c0ecb8447":
            return inst["id"]
    return instances[0]["id"]


@pytest.fixture(scope="module")
def H(auth_token, instance_id):
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Instance-ID": instance_id,
        "Content-Type": "application/json",
    }


@pytest.fixture(autouse=True)
def clean_counters(instance_id):
    """Ensure DB has no leftover scripted counters for this instance before each test."""
    _run(server.db.scripted_counters.delete_many({"instance_id": instance_id}))
    yield
    _run(server.db.scripted_counters.delete_many({"instance_id": instance_id}))


# --------------------------------------------------------------------------- #
# GET /api/discord/scripted-counters/count                                    #
# --------------------------------------------------------------------------- #

class TestScriptedCountersCount:

    def test_a_empty_db_all_zeros(self, H):
        r = requests.get(f"{BASE_URL}/api/discord/scripted-counters/count", headers=H, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["active_counters"] == 0
        assert d["total_counters"] == 0
        assert d["stale_counters"] == 0
        assert "skips_last_24h" in d
        assert "reset_hours" in d
        assert isinstance(d["reset_hours"], int) and d["reset_hours"] >= 1

    def test_b_seed_active_row(self, H, instance_id):
        now = datetime.now(timezone.utc)
        _run(server.db.scripted_counters.insert_one({
            "instance_id": instance_id,
            "channel_id": f"TEST_ch_{uuid.uuid4().hex[:6]}",
            "user_id": f"TEST_usr_{uuid.uuid4().hex[:6]}",
            "count": 1, "used_replies": ["x"],
            "last_at": now.isoformat(),
        }))
        r = requests.get(f"{BASE_URL}/api/discord/scripted-counters/count", headers=H, timeout=20)
        d = r.json()
        assert d["active_counters"] == 1
        assert d["total_counters"] == 1
        assert d["stale_counters"] == 0

    def test_c_seed_stale_row(self, H, instance_id):
        # Read configured reset_hours from the count endpoint
        r0 = requests.get(f"{BASE_URL}/api/discord/scripted-counters/count", headers=H, timeout=20)
        reset_hours = r0.json()["reset_hours"]
        stale_iso = (datetime.now(timezone.utc) - timedelta(hours=reset_hours + 1)).isoformat()
        _run(server.db.scripted_counters.insert_one({
            "instance_id": instance_id,
            "channel_id": f"TEST_ch_{uuid.uuid4().hex[:6]}",
            "user_id": f"TEST_usr_{uuid.uuid4().hex[:6]}",
            "count": 3, "used_replies": ["a"],
            "last_at": stale_iso,
        }))
        r = requests.get(f"{BASE_URL}/api/discord/scripted-counters/count", headers=H, timeout=20)
        d = r.json()
        assert d["total_counters"] == 1
        assert d["active_counters"] == 0
        assert d["stale_counters"] == 1

    def test_d_reset_hours_reflects_instance_config(self, H, instance_id):
        # Set reset_hours=12 via PUT, then verify count endpoint echoes it
        payload = {"scripted_mode": {
            "enabled": True,
            "primary_message": "P", "update_message": "U",
            "variants": ["v"], "fallback_message": "fb",
            "max_attempts": 10, "reset_hours": 12,
            "rephrase_mode": "ai",
        }}
        requests.put(f"{BASE_URL}/api/discord/config", headers=H, json=payload, timeout=20)
        r = requests.get(f"{BASE_URL}/api/discord/scripted-counters/count", headers=H, timeout=20)
        assert r.json()["reset_hours"] == 12
        # restore to 24
        payload["scripted_mode"]["reset_hours"] = 24
        requests.put(f"{BASE_URL}/api/discord/config", headers=H, json=payload, timeout=20)


# --------------------------------------------------------------------------- #
# POST /api/discord/scripted-mode/sandbox                                     #
# --------------------------------------------------------------------------- #

SANDBOX_CFG = {
    "primary_message": "PRIMARY",
    "update_message": "UPDATE",
    "variants": ["v1", "v2"],
    "acknowledgment_replies": ["A1", "A2"],
    "fallback_message": "FB",
    "max_attempts": 10,
    "reset_hours": 24,
    "rephrase_mode": "ai",
    "classify_intent": False,
}


class TestScriptedSandboxValidation:

    def test_a_empty_messages_400(self, H):
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/sandbox",
                          headers=H, json={"messages": []}, timeout=20)
        assert r.status_code == 400

    def test_b_too_many_messages_400(self, H):
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/sandbox",
                          headers=H, json={"messages": ["x"] * 26}, timeout=20)
        assert r.status_code == 400


class TestScriptedSandboxBehavior:

    def test_c_three_message_sequence_shape(self, H, instance_id):
        body = {
            "messages": ["is the bridge down?", "any update?", "thanks!"],
            "scripted_config": SANDBOX_CFG,
        }
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/sandbox",
                          headers=H, json=body, timeout=60)
        assert r.status_code == 200, r.text
        turns = r.json()["turns"]
        assert isinstance(turns, list) and len(turns) == 3
        keys = {"user_message", "intent", "pool_name", "pool_considered",
                "bot_reply", "skip_reason", "count_after", "used_replies_after"}
        for t in turns:
            assert keys.issubset(t.keys()), f"missing keys: {keys - set(t.keys())}"

    def test_d_sandbox_does_not_write_counters(self, H, instance_id):
        before = _run(server.db.scripted_counters.count_documents({"instance_id": instance_id}))
        body = {
            "messages": ["m1", "m2", "m3"],
            "scripted_config": SANDBOX_CFG,
        }
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/sandbox",
                          headers=H, json=body, timeout=60)
        assert r.status_code == 200
        after = _run(server.db.scripted_counters.count_documents({"instance_id": instance_id}))
        assert after == before == 0, "Sandbox MUST NOT write to scripted_counters"

    def test_e_uses_saved_config_when_no_override(self, H):
        # No scripted_config field — endpoint must read from saved DB config
        # (which already has reset_hours/primary set from earlier test).
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/sandbox",
                          headers=H, json={"messages": ["hi"]}, timeout=60)
        assert r.status_code == 200, r.text


class TestSandboxStateProgression:

    def test_turn0_primary(self, H):
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/sandbox",
                          headers=H, json={"messages": ["q1"], "scripted_config": SANDBOX_CFG}, timeout=60)
        t = r.json()["turns"][0]
        assert t["pool_name"] == "primary"
        assert t["count_after"] == 1
        assert t["used_replies_after"] == ["PRIMARY"]

    def test_turn1_update_when_update_set(self, H):
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/sandbox",
                          headers=H, json={"messages": ["q1", "q2"], "scripted_config": SANDBOX_CFG}, timeout=60)
        turns = r.json()["turns"]
        assert turns[1]["pool_name"] == "update"
        assert turns[1]["count_after"] == 2

    def test_exhausted_after_pool_drained(self, H):
        cfg = {**SANDBOX_CFG, "variants": ["v1"], "fallback_message": ""}
        # 1=primary, 2=update, 3=variant(v1), 4=exhausted, 5=exhausted
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/sandbox",
                          headers=H,
                          json={"messages": ["q1", "q2", "q3", "q4", "q5"], "scripted_config": cfg},
                          timeout=120)
        turns = r.json()["turns"]
        assert turns[0]["pool_name"] == "primary"
        assert turns[1]["pool_name"] == "update"
        # turn[2] depends on intent classification — could be variant
        # turn[3+] should be silent/exhausted once pool dries up
        last = turns[-1]
        assert last["pool_name"] == "silent"
        assert last["bot_reply"] == ""
        assert last["skip_reason"] in ("exhausted", "max_attempts")

    def test_manual_mode_silent_at_count2(self, H):
        cfg = {**SANDBOX_CFG, "rephrase_mode": "manual"}
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/sandbox",
                          headers=H,
                          json={"messages": ["q1", "q2", "q3"], "scripted_config": cfg},
                          timeout=60)
        turns = r.json()["turns"]
        assert turns[0]["pool_name"] == "primary"
        assert turns[1]["pool_name"] == "update"
        assert turns[2]["pool_name"] == "silent"
        assert turns[2]["skip_reason"] == "manual_silent"
        assert turns[2]["bot_reply"] == ""
