"""Tests for Scripted Mode v5 — Fixed Reply1 + Reply2, then no-repeat AI router.

Covers (all 16 cases from review request):
 1. count=0 + ANY intent → primary verbatim, NO pick call
 2. count=1 + update_msg set + ANY intent → update verbatim, NO pick call
 3. count=2 + question + variants → pick from variants (NOT primary/update)
 4. count=2 + ack → uses ack pool, used_replies NOT tracked
 5. count=3 + question + used_replies has 'v1' → pool filtered to ['v2'] only
 6. count=3 + question + variants exhausted + fallback set → fallback
 7. count=4 + variants exhausted + fallback already used → silent
 8. count=4 + variants exhausted + fallback not set → silent
 9. count=1 + update_msg BLANK + question → AI router engages at msg2
10. count=10 → silent, no pick call
11. speculation at count=2 → silent, no count bump, no pick call
12. Idle reset wipes count + used_replies
13. Manual count=0 → primary, no LLM calls
14. Manual count=1 + update set → update
15. Manual count=2 → silent
16. _ai_pick_variant parser regression (carry-over from v3/v4)
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


# --------------------------------------------------------------------------- #
# Helpers / Fixtures                                                          #
# --------------------------------------------------------------------------- #

def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def new_ids():
    iid = f"TEST_inst_{uuid.uuid4().hex[:8]}"
    cid = f"TEST_ch_{uuid.uuid4().hex[:8]}"
    uid = f"TEST_usr_{uuid.uuid4().hex[:8]}"
    sid = f"TEST_sess_{uuid.uuid4().hex[:6]}"
    yield iid, cid, uid, sid
    _run(server.db.scripted_counters.delete_many({
        "instance_id": iid, "channel_id": cid, "user_id": uid,
    }))
    _run(server.db.scripted_skips.delete_many({"instance_id": iid}))


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
    calls = {"intent": 0, "pick": 0, "pick_options": []}

    async def intent_fn(*a, **kw):
        calls["intent"] += 1
        return intent_value

    async def pick_fn(user_text, options, session_id, instance_id):
        calls["pick"] += 1
        calls["pick_options"].append(list(options))
        return pick_value

    monkeypatch.setattr(server, "_classify_user_intent", intent_fn)
    monkeypatch.setattr(server, "_ai_pick_variant", pick_fn)
    return calls


def _get_counter(iid, cid, uid):
    return _run(server.db.scripted_counters.find_one({
        "instance_id": iid, "channel_id": cid, "user_id": uid,
    })) or {}


def _seed(iid, cid, uid, count, used_replies=None, last_at="2099-01-01T00:00:00+00:00"):
    _run(server.db.scripted_counters.insert_one({
        "instance_id": iid, "channel_id": cid, "user_id": uid,
        "count": count, "used_replies": used_replies or [],
        "last_at": last_at,
    }))


# --------------------------------------------------------------------------- #
# Case 16 (kept first for clarity): _ai_pick_variant parser regression        #
# --------------------------------------------------------------------------- #

class TestAiPickVariantParser:
    OPTIONS = ["alpha", "beta", "gamma"]

    @pytest.mark.parametrize("claude_out,expected", [
        ("option 2", 2),
        ("Pick: 1", 1),
        ("-1", 0),
        ("garbage", 0),
        ("", 0),
    ])
    def test_parser(self, monkeypatch, claude_out, expected):
        async def fake(*a, **kw):
            return claude_out
        monkeypatch.setattr(server, "call_claude", fake)
        idx = _run(server._ai_pick_variant("hi", self.OPTIONS, "s1", "i1"))
        assert idx == expected


# --------------------------------------------------------------------------- #
# AI Mode — Fixed Reply 1 + Reply 2 (cases 1, 2)                              #
# --------------------------------------------------------------------------- #

class TestFixedReply1And2:

    # Case 1
    def test_case1_count0_any_intent_returns_primary_no_pick(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        # Even intent='ack' should not matter at count=0 — primary fires verbatim
        calls = _mock(monkeypatch, intent_value="ack", pick_value=1)
        cfg = _cfg()
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "thanks!"))
        assert out == cfg["primary_message"]
        assert calls["pick"] == 0, "msg1 must NOT call _ai_pick_variant"
        c = _get_counter(iid, cid, uid)
        assert c.get("count") == 1
        assert c.get("used_replies") == [cfg["primary_message"]]

    # Case 2
    def test_case2_count1_update_set_returns_update_no_pick(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        calls = _mock(monkeypatch, intent_value="ack", pick_value=1)
        cfg = _cfg()
        _seed(iid, cid, uid, count=1, used_replies=[cfg["primary_message"]])
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "any update?"))
        assert out == cfg["update_message"]
        assert calls["pick"] == 0, "msg2 (with update_msg set) must NOT call _ai_pick_variant"
        c = _get_counter(iid, cid, uid)
        assert c.get("count") == 2
        assert c.get("used_replies") == [cfg["primary_message"], cfg["update_message"]]


# --------------------------------------------------------------------------- #
# AI Mode — Msg3+ router (cases 3, 4, 5, 6, 7, 8)                             #
# --------------------------------------------------------------------------- #

class TestMsg3PlusRouter:

    # Case 3
    def test_case3_count2_question_variants_only_pool(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        calls = _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(variants=["v1", "v2"])
        _seed(iid, cid, uid, count=2, used_replies=[cfg["primary_message"], cfg["update_message"]])
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "still?"))
        assert out == "v1"
        # The pool given to _ai_pick_variant MUST exclude primary and update
        pool = calls["pick_options"][0]
        assert cfg["primary_message"] not in pool
        assert cfg["update_message"] not in pool
        assert set(pool) == {"v1", "v2"}
        c = _get_counter(iid, cid, uid)
        assert c["count"] == 3
        assert "v1" in c["used_replies"]

    # Case 4
    def test_case4_count2_ack_intent_uses_ack_pool_not_tracked(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        calls = _mock(monkeypatch, intent_value="ack", pick_value=1)
        cfg = _cfg(acknowledgment_replies=["You're welcome!", "Anytime!", "No problem!"])
        _seed(iid, cid, uid, count=2, used_replies=[cfg["primary_message"], cfg["update_message"]])
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "thanks"))
        assert out in cfg["acknowledgment_replies"]
        # _ai_pick_variant should be called with the ack pool, not variants
        pool = calls["pick_options"][0]
        assert set(pool).issubset(set(cfg["acknowledgment_replies"]))
        c = _get_counter(iid, cid, uid)
        # Acks must NOT push to used_replies
        for ack in cfg["acknowledgment_replies"]:
            assert ack not in c.get("used_replies", [])
        # used_replies stays at the pre-existing primary/update
        assert c["used_replies"] == [cfg["primary_message"], cfg["update_message"]]

    # Case 5
    def test_case5_count3_question_used_replies_filters_pool(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        calls = _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(variants=["v1", "v2"])
        _seed(iid, cid, uid, count=3,
              used_replies=[cfg["primary_message"], cfg["update_message"], "v1"])
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "again?"))
        assert out == "v2"
        pool = calls["pick_options"][0]
        assert pool == ["v2"]  # v1 filtered out

    # Case 6
    def test_case6_variants_exhausted_returns_fallback(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(variants=["v1", "v2"])
        _seed(iid, cid, uid, count=3,
              used_replies=[cfg["primary_message"], cfg["update_message"], "v1", "v2"])
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "more?"))
        assert out == cfg["fallback_message"]
        c = _get_counter(iid, cid, uid)
        assert cfg["fallback_message"] in c["used_replies"]

    # Case 7
    def test_case7_variants_exhausted_fallback_already_used_silent(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(variants=["v1", "v2"])
        _seed(iid, cid, uid, count=4,
              used_replies=[cfg["primary_message"], cfg["update_message"],
                            "v1", "v2", cfg["fallback_message"]])
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "????"))
        assert out == ""

    # Case 8
    def test_case8_variants_exhausted_no_fallback_silent(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(variants=["v1", "v2"], fallback_message="")
        _seed(iid, cid, uid, count=4,
              used_replies=[cfg["primary_message"], cfg["update_message"], "v1", "v2"])
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "??"))
        assert out == ""


# --------------------------------------------------------------------------- #
# AI Mode — Edge case: update_msg BLANK (case 9)                              #
# --------------------------------------------------------------------------- #

class TestUpdateBlankEdgeCase:

    # Case 9 — admin left update_msg empty → msg2 goes to AI router directly
    def test_case9_count1_update_blank_engages_router(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        calls = _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(update_message="", variants=["v1", "v2"])
        _seed(iid, cid, uid, count=1, used_replies=[cfg["primary_message"]])
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "still?"))
        # Router engages at msg2 since no update — picks first variant
        assert out == "v1"
        assert calls["pick"] == 1
        pool = calls["pick_options"][0]
        # Pool excludes primary (already used) — purely variants
        assert cfg["primary_message"] not in pool
        assert set(pool) == {"v1", "v2"}


# --------------------------------------------------------------------------- #
# AI Mode — Cap, speculation, idle reset (cases 10, 11, 12)                   #
# --------------------------------------------------------------------------- #

class TestCapAndGates:

    # Case 10
    def test_case10_max_attempts_cap_no_pick_call(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        calls = _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(max_attempts=10)
        _seed(iid, cid, uid, count=10, used_replies=["x"] * 10)
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "still?"))
        assert out == ""
        # The cap check is BEFORE classify+pick → both must be 0
        assert calls["intent"] == 0
        assert calls["pick"] == 0

    # Case 11
    def test_case11_speculation_silent_no_count_bump_no_pick(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        calls = _mock(monkeypatch, intent_value="speculation", pick_value=1)
        cfg = _cfg()
        _seed(iid, cid, uid, count=2,
              used_replies=[cfg["primary_message"], cfg["update_message"]])
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "team sleeping lol"))
        assert out == ""
        c = _get_counter(iid, cid, uid)
        assert c["count"] == 2  # unchanged
        assert calls["pick"] == 0

    # Case 12
    def test_case12_idle_reset_wipes_count_and_used_replies(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(reset_hours=24)
        from datetime import datetime, timezone, timedelta
        stale = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
        _seed(iid, cid, uid, count=5, used_replies=["x", "y"], last_at=stale)
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "fresh?"))
        # After reset, returns primary (count effectively starts at 0)
        assert out == cfg["primary_message"]
        c = _get_counter(iid, cid, uid)
        assert c["count"] == 1
        assert c["used_replies"] == [cfg["primary_message"]]


# --------------------------------------------------------------------------- #
# Manual Mode (cases 13, 14, 15)                                              #
# --------------------------------------------------------------------------- #

class TestManualMode:

    # Case 13
    def test_case13_manual_count0_returns_primary_no_llm(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        calls = _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(rephrase_mode="manual")
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "is it down?"))
        assert out == cfg["primary_message"]
        assert calls["intent"] == 0
        assert calls["pick"] == 0
        c = _get_counter(iid, cid, uid)
        assert c["count"] == 1

    # Case 14
    def test_case14_manual_count1_update_set_returns_update(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        calls = _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(rephrase_mode="manual")
        _seed(iid, cid, uid, count=1, used_replies=[cfg["primary_message"]])
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "any update?"))
        assert out == cfg["update_message"]
        assert calls["pick"] == 0

    # Case 15
    def test_case15_manual_count2_silent(self, monkeypatch, new_ids):
        iid, cid, uid, sid = new_ids
        _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(rephrase_mode="manual")
        _seed(iid, cid, uid, count=2,
              used_replies=[cfg["primary_message"], cfg["update_message"]])
        out = _run(server.build_scripted_response(iid, cid, uid, cfg, sid, "m3"))
        assert out == ""


# --------------------------------------------------------------------------- #
# NEW: _decide_scripted_reply pure helper — pool_name & skip_reason coverage  #
# --------------------------------------------------------------------------- #

class TestDecideScriptedReplyPureHelper:
    """Tests the new pure decision helper (no DB IO). Verifies the full pool_name
    enum {primary|update|variant|ack|fallback|silent} and the skip_reason enum
    {None|max_attempts|speculation|exhausted|no_primary|manual_silent}."""

    def test_pool_primary_at_count0(self, monkeypatch):
        _mock(monkeypatch, intent_value="question", pick_value=1)
        d = _run(server._decide_scripted_reply(_cfg(), 0, [], "hi", "s", "i"))
        assert d["pool_name"] == "primary"
        assert d["skip_reason"] is None
        assert d["reply"] == _cfg()["primary_message"]

    def test_pool_update_at_count1_with_update_msg(self, monkeypatch):
        _mock(monkeypatch, intent_value="question", pick_value=1)
        d = _run(server._decide_scripted_reply(_cfg(), 1, [_cfg()["primary_message"]], "any update?", "s", "i"))
        assert d["pool_name"] == "update"
        assert d["skip_reason"] is None
        assert d["reply"] == _cfg()["update_message"]

    def test_pool_variant_at_count2_question(self, monkeypatch):
        _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(variants=["v1", "v2"])
        d = _run(server._decide_scripted_reply(cfg, 2, [cfg["primary_message"], cfg["update_message"]], "still?", "s", "i"))
        assert d["pool_name"] == "variant"
        assert d["reply"] == "v1"
        assert d["skip_reason"] is None

    def test_pool_ack_at_count2_with_ack_intent(self, monkeypatch):
        _mock(monkeypatch, intent_value="ack", pick_value=1)
        cfg = _cfg()
        d = _run(server._decide_scripted_reply(cfg, 2, [cfg["primary_message"], cfg["update_message"]], "thanks", "s", "i"))
        assert d["pool_name"] == "ack"
        assert d["reply"] in cfg["acknowledgment_replies"]
        assert d["skip_reason"] is None

    def test_pool_fallback_when_variants_exhausted(self, monkeypatch):
        _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(variants=["v1", "v2"])
        d = _run(server._decide_scripted_reply(cfg, 3, [cfg["primary_message"], cfg["update_message"], "v1", "v2"], "more?", "s", "i"))
        assert d["pool_name"] == "fallback"
        assert d["reply"] == cfg["fallback_message"]
        assert d["skip_reason"] is None

    def test_skip_max_attempts(self, monkeypatch):
        _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(max_attempts=10)
        d = _run(server._decide_scripted_reply(cfg, 10, ["x"] * 10, "still?", "s", "i"))
        assert d["pool_name"] == "silent"
        assert d["skip_reason"] == "max_attempts"
        assert d["reply"] == ""

    def test_skip_speculation(self, monkeypatch):
        _mock(monkeypatch, intent_value="speculation", pick_value=1)
        cfg = _cfg()
        d = _run(server._decide_scripted_reply(cfg, 2, [cfg["primary_message"], cfg["update_message"]], "team sleeping lol", "s", "i"))
        assert d["pool_name"] == "silent"
        assert d["skip_reason"] == "speculation"
        assert d["intent"] == "speculation"

    def test_skip_exhausted(self, monkeypatch):
        _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(variants=["v1"], fallback_message="")
        d = _run(server._decide_scripted_reply(cfg, 3, [cfg["primary_message"], cfg["update_message"], "v1"], "???", "s", "i"))
        assert d["pool_name"] == "silent"
        assert d["skip_reason"] == "exhausted"

    def test_skip_no_primary(self, monkeypatch):
        _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(primary_message="")
        d = _run(server._decide_scripted_reply(cfg, 0, [], "anything", "s", "i"))
        assert d["pool_name"] == "silent"
        assert d["skip_reason"] == "no_primary"

    def test_skip_manual_silent_at_count2(self, monkeypatch):
        _mock(monkeypatch, intent_value="question", pick_value=1)
        cfg = _cfg(rephrase_mode="manual")
        d = _run(server._decide_scripted_reply(cfg, 2, [cfg["primary_message"], cfg["update_message"]], "m3", "s", "i"))
        assert d["pool_name"] == "silent"
        assert d["skip_reason"] == "manual_silent"
        assert d["reply"] == ""



# --------------------------------------------------------------------------- #
# HTTP regression: config persistence + reset endpoint                        #
# --------------------------------------------------------------------------- #

@pytest.fixture(scope="module")
def auth_token():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not set")
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD,
    }, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def instance_id(auth_token):
    r = requests.get(
        f"{BASE_URL}/api/admin/instances",
        headers={"Authorization": f"Bearer {auth_token}"}, timeout=20,
    )
    if r.status_code != 200 or not r.json():
        pytest.skip("No instances available")
    return r.json()[0]["id"]


@pytest.fixture(scope="module")
def H(auth_token, instance_id):
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Instance-ID": instance_id,
        "Content-Type": "application/json",
    }


class TestDiscordConfigPersistence:
    def test_put_scripted_mode_full_payload_round_trip(self, H):
        payload = {
            "scripted_mode": {
                "enabled": True,
                "primary_message": "TEST_PRIMARY",
                "update_message": "TEST_UPDATE",
                "variants": ["TEST_V1", "TEST_V2"],
                "acknowledgment_replies": ["TEST_A1", "TEST_A2"],
                "fallback_message": "TEST_FB",
                "max_attempts": 10,
                "reset_hours": 24,
                "rephrase_mode": "ai",
            }
        }
        r = requests.put(f"{BASE_URL}/api/discord/config", headers=H, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        g = requests.get(f"{BASE_URL}/api/discord/config", headers=H, timeout=20)
        assert g.status_code == 200
        sm = g.json().get("scripted_mode") or {}
        assert sm.get("max_attempts") == 10
        assert sm.get("primary_message") == "TEST_PRIMARY"
        assert sm.get("update_message") == "TEST_UPDATE"
        assert "TEST_V1" in (sm.get("variants") or [])
        assert "TEST_A1" in (sm.get("acknowledgment_replies") or [])
        assert sm.get("fallback_message") == "TEST_FB"


class TestResetCountersClearsUsedReplies:
    def test_reset_endpoint_clears_count_and_used_replies(self, H, instance_id):
        cid = f"TEST_ch_{uuid.uuid4().hex[:6]}"
        uid = f"TEST_usr_{uuid.uuid4().hex[:6]}"
        _run(server.db.scripted_counters.insert_one({
            "instance_id": instance_id, "channel_id": cid, "user_id": uid,
            "count": 5, "used_replies": ["a", "b", "c"],
            "last_at": "2099-01-01T00:00:00+00:00",
        }))
        r = requests.post(f"{BASE_URL}/api/discord/scripted-counters/reset",
                          headers=H, timeout=20)
        assert r.status_code == 200, r.text
        doc = _run(server.db.scripted_counters.find_one({
            "instance_id": instance_id, "channel_id": cid, "user_id": uid,
        }))
        # Either deleted or count reset & used_replies cleared
        if doc is not None:
            assert doc.get("count", 0) == 0
            assert (doc.get("used_replies") or []) == []
        else:
            assert doc is None
