"""Unit + HTTP tests for Saved Scenarios regression suite (Scripted Mode).

Backend coverage:
 - _compare_against_golden: empty diff, turn_count mismatch, pool_name mismatch,
   intent mismatch, skip-None-intent compatibility (5 cases)
 - _run_scenario_doc: captures golden on first run, pass on identical re-run,
   fail on diverging config (3 cases)
 - HTTP endpoints: POST/GET/DELETE scenarios, /run, /save-golden, /run-all,
   validation, scoping across X-Instance-ID, persistence to db.scripted_scenarios
"""
import os
import sys
import uuid
import asyncio
import pytest
import requests

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import server  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"
TEST_INSTANCE = "8292460c-de40-4a28-a711-640c0ecb8447"


# --------------------------------------------------------------------------- #
# Async helpers                                                               #
# --------------------------------------------------------------------------- #

def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


def _cfg(**over):
    base = {
        "primary_message": "PRIMARY: We are aware.",
        "update_message": "UPDATE: Still investigating.",
        "variants": ["v1", "v2", "v3"],
        "acknowledgment_replies": ["A1", "A2", "A3"],
        "fallback_message": "FALLBACK: hold tight.",
        "max_attempts": 10,
        "reset_hours": 24,
        "rephrase_mode": "ai",
        "classify_intent": False,
    }
    base.update(over)
    return base


def _mock(monkeypatch, intent_value="question", pick_value=1):
    """Mock both AI helpers so scenario runs are deterministic."""
    async def intent_fn(*a, **kw):
        return intent_value

    async def pick_fn(user_text, options, session_id, instance_id):
        return pick_value

    monkeypatch.setattr(server, "_classify_user_intent", intent_fn)
    monkeypatch.setattr(server, "_ai_pick_variant", pick_fn)


# --------------------------------------------------------------------------- #
# _compare_against_golden — 5 cases                                           #
# --------------------------------------------------------------------------- #
class TestCompareAgainstGolden:
    """Pure function — returns list of failure dicts; empty == pass."""

    def test_identical_turns_returns_empty(self):
        turns = [
            {"pool_name": "primary", "intent": None, "bot_reply": "p"},
            {"pool_name": "update", "intent": None, "bot_reply": "u"},
            {"pool_name": "variants", "intent": "question", "bot_reply": "v2"},
        ]
        golden = [
            {"pool_name": "primary", "intent": None, "bot_reply": "p"},
            {"pool_name": "update", "intent": None, "bot_reply": "u"},
            {"pool_name": "variants", "intent": "question", "bot_reply": "v2"},
        ]
        assert server._compare_against_golden(turns, golden) == []

    def test_turn_count_mismatch(self):
        turns = [{"pool_name": "primary", "intent": None}]
        golden = [
            {"pool_name": "primary", "intent": None},
            {"pool_name": "update", "intent": None},
        ]
        failures = server._compare_against_golden(turns, golden)
        assert len(failures) == 1
        assert failures[0]["field"] == "turn_count"
        assert failures[0]["expected"] == 2
        assert failures[0]["actual"] == 1
        assert failures[0]["turn_index"] == -1

    def test_pool_name_mismatch_per_turn(self):
        turns = [
            {"pool_name": "primary", "intent": None},
            {"pool_name": "ack", "intent": "ack"},     # divergence
        ]
        golden = [
            {"pool_name": "primary", "intent": None},
            {"pool_name": "variants", "intent": "question"},
        ]
        failures = server._compare_against_golden(turns, golden)
        # Expect both pool_name and intent mismatches at index 1
        pool_fails = [f for f in failures if f["field"] == "pool_name"]
        assert len(pool_fails) == 1
        assert pool_fails[0]["turn_index"] == 1
        assert pool_fails[0]["expected"] == "variants"
        assert pool_fails[0]["actual"] == "ack"

    def test_intent_mismatch_when_golden_has_intent(self):
        turns = [{"pool_name": "variants", "intent": "ack"}]
        golden = [{"pool_name": "variants", "intent": "question"}]
        failures = server._compare_against_golden(turns, golden)
        intent_fails = [f for f in failures if f["field"] == "intent"]
        assert len(intent_fails) == 1
        assert intent_fails[0]["turn_index"] == 0
        assert intent_fails[0]["expected"] == "question"
        assert intent_fails[0]["actual"] == "ack"

    def test_intent_comparison_skipped_when_golden_none(self):
        """Primary/update turns don't classify — golden.intent=None should NOT
        cause a failure even if the new turn classified the intent."""
        turns = [{"pool_name": "primary", "intent": "question"}]
        golden = [{"pool_name": "primary", "intent": None}]
        failures = server._compare_against_golden(turns, golden)
        assert failures == []


# --------------------------------------------------------------------------- #
# _run_scenario_doc — 3 cases (uses real DB)                                  #
# --------------------------------------------------------------------------- #
class TestRunScenarioDoc:
    """Integration-ish — touches db.scripted_scenarios but with TEST_ ids."""

    @pytest.fixture
    def fresh_scenario(self):
        iid = f"TEST_inst_{uuid.uuid4().hex[:8]}"
        sid = str(uuid.uuid4())
        doc = {
            "id": sid,
            "instance_id": iid,
            "name": "TEST_scn",
            "messages": ["is the bridge down?", "any update?", "thanks!"],
            "golden_turns": None,
            "last_run": None,
        }
        _run(server.db.scripted_scenarios.insert_one(dict(doc)))
        yield doc
        _run(server.db.scripted_scenarios.delete_many({"instance_id": iid}))

    def test_first_run_captures_golden(self, monkeypatch, fresh_scenario):
        _mock(monkeypatch, intent_value="question", pick_value=1)
        result = _run(server._run_scenario_doc(fresh_scenario, _cfg(), fresh_scenario["instance_id"]))
        assert result["status"] == "captured_golden"
        assert len(result["turns"]) == 3
        assert result["failures"] == []
        # Persisted
        saved = _run(server.db.scripted_scenarios.find_one({"id": fresh_scenario["id"]}, {"_id": 0}))
        assert saved["golden_turns"] is not None
        assert len(saved["golden_turns"]) == 3
        assert saved["last_run"]["status"] == "captured_golden"
        # Golden stores pool_name + intent + bot_reply (only first two compared)
        assert saved["golden_turns"][0]["pool_name"] == "primary"
        assert saved["golden_turns"][1]["pool_name"] == "update"

    def test_second_run_matching_golden_passes(self, monkeypatch, fresh_scenario):
        _mock(monkeypatch, intent_value="question", pick_value=1)
        # First call → captures
        _run(server._run_scenario_doc(fresh_scenario, _cfg(), fresh_scenario["instance_id"]))
        # Reload the scenario with the captured golden
        scn = _run(server.db.scripted_scenarios.find_one({"id": fresh_scenario["id"]}, {"_id": 0}))
        # Second call with SAME mocks & cfg
        result = _run(server._run_scenario_doc(scn, _cfg(), scn["instance_id"]))
        assert result["status"] == "pass", f"failures: {result.get('failures')}"
        assert result["failures"] == []
        # last_run persisted
        saved = _run(server.db.scripted_scenarios.find_one({"id": scn["id"]}, {"_id": 0}))
        assert saved["last_run"]["status"] == "pass"

    def test_diverging_cfg_fails_with_failures_list(self, monkeypatch, fresh_scenario):
        # Capture golden with classify=question
        _mock(monkeypatch, intent_value="question", pick_value=1)
        _run(server._run_scenario_doc(fresh_scenario, _cfg(), fresh_scenario["instance_id"]))
        scn = _run(server.db.scripted_scenarios.find_one({"id": fresh_scenario["id"]}, {"_id": 0}))
        # Now divergence: classify_intent ON + intent flips to "ack" on the 3rd
        # message → pool_name flips from "variants" to "ack" at turn index 2
        _mock(monkeypatch, intent_value="ack", pick_value=1)
        result = _run(server._run_scenario_doc(scn, _cfg(classify_intent=True), scn["instance_id"]))
        assert result["status"] == "fail"
        assert len(result["failures"]) >= 1
        # At least one failure should be a pool_name mismatch at turn_index 2
        pool_fails = [f for f in result["failures"] if f["field"] == "pool_name"]
        assert any(f["turn_index"] == 2 for f in pool_fails)
        saved = _run(server.db.scripted_scenarios.find_one({"id": scn["id"]}, {"_id": 0}))
        assert saved["last_run"]["status"] == "fail"


# --------------------------------------------------------------------------- #
# HTTP endpoints                                                              #
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def auth_headers():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not set")
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email_or_username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
                      timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    token = r.json().get("access_token") or r.json().get("token")
    return {
        "Authorization": f"Bearer {token}",
        "X-Instance-ID": TEST_INSTANCE,
        "Content-Type": "application/json",
    }


@pytest.fixture(autouse=False)
def cleanup_scenarios():
    """Cleanup TEST_* scenarios in the test instance after the test."""
    yield
    _run(server.db.scripted_scenarios.delete_many({
        "instance_id": TEST_INSTANCE,
        "name": {"$regex": "^TEST_"},
    }))


class TestScenarioHTTP:
    def test_create_empty_name_returns_400(self, auth_headers, cleanup_scenarios):
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/scenarios",
                          headers=auth_headers, json={"name": "", "messages": ["hi"]})
        assert r.status_code == 400

    def test_create_empty_messages_returns_400(self, auth_headers, cleanup_scenarios):
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/scenarios",
                          headers=auth_headers, json={"name": "TEST_x", "messages": []})
        assert r.status_code == 400

    def test_create_over_25_messages_returns_400(self, auth_headers, cleanup_scenarios):
        msgs = [f"m{i}" for i in range(26)]
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/scenarios",
                          headers=auth_headers, json={"name": "TEST_x", "messages": msgs})
        assert r.status_code == 400

    def test_create_valid_returns_scenario_shape_and_persists(self, auth_headers, cleanup_scenarios):
        name = f"TEST_create_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/scenarios",
                          headers=auth_headers, json={"name": name, "messages": ["a", "b"]})
        assert r.status_code in (200, 201)
        data = r.json()
        for k in ("id", "instance_id", "name", "messages", "golden_turns", "last_run", "created_at"):
            assert k in data, f"missing key {k}"
        assert data["name"] == name
        assert data["instance_id"] == TEST_INSTANCE
        assert data["golden_turns"] is None
        assert data["last_run"] is None
        # Persistence check
        found = _run(server.db.scripted_scenarios.find_one({"id": data["id"]}, {"_id": 0}))
        assert found is not None
        assert found["name"] == name

    def test_list_returns_only_this_instance(self, auth_headers, cleanup_scenarios):
        # Seed scenario in TEST_INSTANCE
        name = f"TEST_list_{uuid.uuid4().hex[:6]}"
        requests.post(f"{BASE_URL}/api/discord/scripted-mode/scenarios",
                      headers=auth_headers, json={"name": name, "messages": ["x"]})
        # Insert one in a different instance directly in DB
        other_iid = f"TEST_other_{uuid.uuid4().hex[:8]}"
        _run(server.db.scripted_scenarios.insert_one({
            "id": str(uuid.uuid4()), "instance_id": other_iid,
            "name": "TEST_other_scope", "messages": ["x"],
            "golden_turns": None, "last_run": None,
        }))
        try:
            r = requests.get(f"{BASE_URL}/api/discord/scripted-mode/scenarios",
                             headers=auth_headers)
            assert r.status_code == 200
            scns = r.json()["scenarios"]
            iids = {s["instance_id"] for s in scns}
            assert TEST_INSTANCE in iids or len(scns) == 0 or all(i == TEST_INSTANCE for i in iids)
            assert other_iid not in iids
        finally:
            _run(server.db.scripted_scenarios.delete_many({"instance_id": other_iid}))

    def test_delete_404_when_not_found(self, auth_headers, cleanup_scenarios):
        r = requests.delete(f"{BASE_URL}/api/discord/scripted-mode/scenarios/{uuid.uuid4()}",
                            headers=auth_headers)
        assert r.status_code == 404

    def test_delete_scoped_by_instance(self, auth_headers, cleanup_scenarios):
        # Seed a scenario in instance B directly
        other_iid = f"TEST_otherinst_{uuid.uuid4().hex[:8]}"
        sid = str(uuid.uuid4())
        _run(server.db.scripted_scenarios.insert_one({
            "id": sid, "instance_id": other_iid,
            "name": "TEST_scoped", "messages": ["x"],
            "golden_turns": None, "last_run": None,
        }))
        try:
            # Delete from TEST_INSTANCE → must NOT affect other_iid's row
            r = requests.delete(f"{BASE_URL}/api/discord/scripted-mode/scenarios/{sid}",
                                headers=auth_headers)
            assert r.status_code == 404
            still_there = _run(server.db.scripted_scenarios.find_one({"id": sid}))
            assert still_there is not None
        finally:
            _run(server.db.scripted_scenarios.delete_many({"instance_id": other_iid}))

    def test_run_first_captures_then_passes_with_override(self, auth_headers, cleanup_scenarios):
        """Use scripted_config body override so it's deterministic without mocks."""
        cfg = _cfg()
        # Create scenario
        name = f"TEST_run_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/scenarios",
                          headers=auth_headers,
                          json={"name": name, "messages": ["msg one", "msg two"]})
        assert r.status_code in (200, 201), r.text
        sid = r.json()["id"]
        # First run → captured_golden
        r1 = requests.post(
            f"{BASE_URL}/api/discord/scripted-mode/scenarios/{sid}/run",
            headers=auth_headers, json={"scripted_config": cfg}, timeout=60,
        )
        assert r1.status_code == 200, r1.text
        body1 = r1.json()
        assert body1["status"] == "captured_golden"
        assert len(body1["turns"]) == 2
        # Second run identical → pass
        r2 = requests.post(
            f"{BASE_URL}/api/discord/scripted-mode/scenarios/{sid}/run",
            headers=auth_headers, json={"scripted_config": cfg}, timeout=60,
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "pass", r2.json()

    def test_save_golden_400_if_no_last_run(self, auth_headers, cleanup_scenarios):
        name = f"TEST_sg_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/scenarios",
                          headers=auth_headers, json={"name": name, "messages": ["a"]})
        sid = r.json()["id"]
        r2 = requests.post(
            f"{BASE_URL}/api/discord/scripted-mode/scenarios/{sid}/save-golden",
            headers=auth_headers, json={})
        assert r2.status_code == 400

    def test_run_all_empty_list_returns_zeros(self, auth_headers):
        # Use a clean isolated instance header
        headers = dict(auth_headers)
        headers["X-Instance-ID"] = f"TEST_runall_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/scenarios/run-all",
                          headers=headers, json={})
        # If the isolated instance fails access check, fall back to checking shape
        if r.status_code == 200:
            data = r.json()
            assert data == {
                "total": 0, "passed": 0, "failed": 0,
                "captured_golden": 0, "results": [],
            }
        else:
            # Use real test instance, but first ensure no scenarios exist
            _run(server.db.scripted_scenarios.delete_many({"instance_id": TEST_INSTANCE}))
            r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/scenarios/run-all",
                              headers=auth_headers, json={})
            assert r.status_code == 200
            data = r.json()
            assert data["total"] == 0 and data["results"] == []
