"""Tests for the Scripted Mode v3 AI Conversation Router (msg3+ branch).

Covers:
- build_scripted_response() msg3+ behavior with rephrase_mode in {manual, ai, hybrid}.
- _ai_pick_variant() input parsing (numeric / "option N" / garbage / out-of-range).
- _classify_user_intent() recognizing the new 'ack' label.
- GET/PUT /api/discord/config auto-seeding of acknowledgment_replies.

All Claude calls are mocked via monkeypatch so the tests are deterministic and
don't incur LLM cost.
"""
import os
import sys
import uuid
import asyncio
import pytest
import requests

# Make /app/backend importable so we can import server module-level helpers
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# We import the module (not the FastAPI app instance) so we can monkeypatch helpers.
import server  # noqa: E402


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"


# --------------------------------------------------------------------------- #
# Helpers                                                                     #
# --------------------------------------------------------------------------- #

def _run(coro):
    """Run an async coroutine inside the test's event loop."""
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def seed_counter():
    """Pre-seed scripted_counters with count=2 so the next build_scripted_response
    call lands in the msg3+ AI router branch (because the function increments
    atomically and uses (new_count - 1) as `count`)."""
    created = []

    async def _seed(instance_id, channel_id, user_id, count=2):
        await server.db.scripted_counters.delete_many({
            "instance_id": instance_id, "channel_id": channel_id, "user_id": user_id,
        })
        await server.db.scripted_counters.insert_one({
            "instance_id": instance_id,
            "channel_id": channel_id,
            "user_id": user_id,
            "count": count,
            "last_at": "2099-01-01T00:00:00+00:00",  # far-future to skip reset branch
        })
        created.append((instance_id, channel_id, user_id))

    yield _seed

    async def _cleanup():
        for instance_id, channel_id, user_id in created:
            await server.db.scripted_counters.delete_many({
                "instance_id": instance_id, "channel_id": channel_id, "user_id": user_id,
            })
    _run(_cleanup())


def _make_cfg(**over):
    base = {
        "primary_message": "We are aware of the issue.",
        "update_message": "Still investigating, thanks for your patience.",
        "variants": ["Variant A about it", "Variant B more detail", "Variant C status"],
        "acknowledgment_replies": ["You're welcome!", "No worries", "Anytime"],
        "fallback_message": "Please hold tight, more soon.",
        "max_attempts": 5,
        "reset_hours": 24,
        "rephrase_mode": "ai",
        "classify_intent": False,
    }
    base.update(over)
    return base


# --------------------------------------------------------------------------- #
# _ai_pick_variant — input parsing                                            #
# --------------------------------------------------------------------------- #

class TestAiPickVariant:
    OPTIONS = ["alpha", "beta", "gamma"]

    @pytest.mark.parametrize("claude_out,expected", [
        ("1", 1),
        ("2", 2),
        ("3", 3),
        ("option 2", 2),
        ("2.", 2),
        ("  3 ", 3),
        ("Pick: 1", 1),
    ])
    def test_valid_outputs_parsed(self, monkeypatch, claude_out, expected):
        async def fake(*a, **kw): return claude_out
        monkeypatch.setattr(server, "call_claude", fake)
        idx = _run(server._ai_pick_variant("hi", self.OPTIONS, "s1", "i1"))
        assert idx == expected

    @pytest.mark.parametrize("claude_out", ["0", "9", "-1", "", "   ", "abc", "no thanks"])
    def test_out_of_range_or_garbage_returns_zero(self, monkeypatch, claude_out):
        async def fake(*a, **kw): return claude_out
        monkeypatch.setattr(server, "call_claude", fake)
        idx = _run(server._ai_pick_variant("hi", self.OPTIONS, "s1", "i1"))
        assert idx == 0

    def test_exception_returns_zero(self, monkeypatch):
        async def boom(*a, **kw): raise RuntimeError("boom")
        monkeypatch.setattr(server, "call_claude", boom)
        idx = _run(server._ai_pick_variant("hi", self.OPTIONS, "s1", "i1"))
        assert idx == 0

    def test_empty_options_returns_zero(self, monkeypatch):
        called = {"n": 0}
        async def fake(*a, **kw):
            called["n"] += 1
            return "1"
        monkeypatch.setattr(server, "call_claude", fake)
        idx = _run(server._ai_pick_variant("hi", [], "s1", "i1"))
        assert idx == 0
        assert called["n"] == 0  # short-circuits, no LLM call


# --------------------------------------------------------------------------- #
# _classify_user_intent — recognizes 'ack'                                    #
# --------------------------------------------------------------------------- #

class TestClassifyIntent:
    def test_ack_label_recognized(self, monkeypatch):
        async def fake(*a, **kw): return "ack"
        monkeypatch.setattr(server, "call_claude", fake)
        out = _run(server._classify_user_intent("thanks", "sess", "inst"))
        assert out == "ack"

    @pytest.mark.parametrize("label", ["question", "update", "speculation", "other"])
    def test_other_labels(self, monkeypatch, label):
        async def fake(*a, **kw): return label
        monkeypatch.setattr(server, "call_claude", fake)
        out = _run(server._classify_user_intent("...", "sess", "inst"))
        assert out == label

    def test_invalid_label_collapses_to_other(self, monkeypatch):
        async def fake(*a, **kw): return "garbage_label"
        monkeypatch.setattr(server, "call_claude", fake)
        out = _run(server._classify_user_intent("...", "sess", "inst"))
        assert out == "other"


# --------------------------------------------------------------------------- #
# build_scripted_response — msg3+ AI router branch                            #
# --------------------------------------------------------------------------- #

class TestBuildScriptedResponseRouter:
    """All tests pre-seed scripted_counters with count=2 so the function lands in msg3+."""

    inst = f"TEST_inst_{uuid.uuid4().hex[:8]}"
    ch = f"TEST_ch_{uuid.uuid4().hex[:8]}"
    usr = f"TEST_usr_{uuid.uuid4().hex[:8]}"
    sess = "TEST_sess"

    def test_manual_mode_silent_no_llm(self, monkeypatch, seed_counter):
        """count=2 + rephrase_mode='manual' → '' (silent), zero LLM calls."""
        _run(seed_counter(self.inst, self.ch, self.usr, count=2))
        calls = {"intent": 0, "pick": 0}
        async def intent(*a, **kw): calls["intent"] += 1; return "question"
        async def pick(*a, **kw): calls["pick"] += 1; return 1
        monkeypatch.setattr(server, "_classify_user_intent", intent)
        monkeypatch.setattr(server, "_ai_pick_variant", pick)

        cfg = _make_cfg(rephrase_mode="manual")
        out = _run(server.build_scripted_response(self.inst, self.ch, self.usr, cfg, self.sess, "any update?"))
        assert out == ""
        assert calls == {"intent": 0, "pick": 0}

    def test_ai_mode_ack_picks_from_ack_pool(self, monkeypatch, seed_counter):
        _run(seed_counter(self.inst, self.ch, self.usr, count=2))
        async def intent(*a, **kw): return "ack"
        captured = {}
        async def pick(user_text, options, session_id, instance_id):
            captured["options"] = list(options)
            return 2
        monkeypatch.setattr(server, "_classify_user_intent", intent)
        monkeypatch.setattr(server, "_ai_pick_variant", pick)

        cfg = _make_cfg(rephrase_mode="ai")
        out = _run(server.build_scripted_response(self.inst, self.ch, self.usr, cfg, self.sess, "thanks"))
        # picked second ack
        assert out == cfg["acknowledgment_replies"][1]
        assert captured["options"] == cfg["acknowledgment_replies"]

    def test_ai_mode_question_picks_from_variants(self, monkeypatch, seed_counter):
        _run(seed_counter(self.inst, self.ch, self.usr, count=2))
        async def intent(*a, **kw): return "question"
        captured = {}
        async def pick(user_text, options, session_id, instance_id):
            captured["options"] = list(options)
            return 3
        monkeypatch.setattr(server, "_classify_user_intent", intent)
        monkeypatch.setattr(server, "_ai_pick_variant", pick)

        cfg = _make_cfg(rephrase_mode="ai")
        out = _run(server.build_scripted_response(self.inst, self.ch, self.usr, cfg, self.sess, "is it back?"))
        assert out == cfg["variants"][2]
        assert captured["options"] == cfg["variants"]

    def test_ai_mode_speculation_silent_ignores_variants(self, monkeypatch, seed_counter):
        _run(seed_counter(self.inst, self.ch, self.usr, count=2))
        async def intent(*a, **kw): return "speculation"
        called = {"pick": 0}
        async def pick(*a, **kw): called["pick"] += 1; return 1
        monkeypatch.setattr(server, "_classify_user_intent", intent)
        monkeypatch.setattr(server, "_ai_pick_variant", pick)

        cfg = _make_cfg(rephrase_mode="ai")
        out = _run(server.build_scripted_response(self.inst, self.ch, self.usr, cfg, self.sess, "team sleeping lol"))
        assert out == ""
        assert called["pick"] == 0  # variants must not be considered

    def test_hybrid_mode_ack_picker_returns_zero_uses_first_ack(self, monkeypatch, seed_counter):
        _run(seed_counter(self.inst, self.ch, self.usr, count=2))
        async def intent(*a, **kw): return "ack"
        async def pick(*a, **kw): return 0   # AI couldn't choose
        monkeypatch.setattr(server, "_classify_user_intent", intent)
        monkeypatch.setattr(server, "_ai_pick_variant", pick)

        cfg = _make_cfg(rephrase_mode="hybrid")
        out = _run(server.build_scripted_response(self.inst, self.ch, self.usr, cfg, self.sess, "thx"))
        assert out == cfg["acknowledgment_replies"][0]  # safe default = first ack

    def test_ai_mode_other_intent_empty_variants_returns_fallback(self, monkeypatch, seed_counter):
        _run(seed_counter(self.inst, self.ch, self.usr, count=2))
        async def intent(*a, **kw): return "other"
        async def pick(*a, **kw): return 0
        monkeypatch.setattr(server, "_classify_user_intent", intent)
        monkeypatch.setattr(server, "_ai_pick_variant", pick)

        cfg = _make_cfg(rephrase_mode="ai", variants=[])
        out = _run(server.build_scripted_response(self.inst, self.ch, self.usr, cfg, self.sess, "random"))
        assert out == cfg["fallback_message"]

    def test_ai_mode_other_intent_empty_variants_no_fallback_silent(self, monkeypatch, seed_counter):
        _run(seed_counter(self.inst, self.ch, self.usr, count=2))
        async def intent(*a, **kw): return "other"
        async def pick(*a, **kw): return 0
        monkeypatch.setattr(server, "_classify_user_intent", intent)
        monkeypatch.setattr(server, "_ai_pick_variant", pick)

        cfg = _make_cfg(rephrase_mode="ai", variants=[], fallback_message="")
        out = _run(server.build_scripted_response(self.inst, self.ch, self.usr, cfg, self.sess, "random"))
        assert out == ""

    def test_ai_mode_missing_acks_uses_defaults(self, monkeypatch, seed_counter):
        _run(seed_counter(self.inst, self.ch, self.usr, count=2))
        async def intent(*a, **kw): return "ack"
        captured = {}
        async def pick(user_text, options, session_id, instance_id):
            captured["options"] = list(options)
            return 1
        monkeypatch.setattr(server, "_classify_user_intent", intent)
        monkeypatch.setattr(server, "_ai_pick_variant", pick)

        cfg = _make_cfg(rephrase_mode="ai")
        cfg.pop("acknowledgment_replies", None)  # missing key
        out = _run(server.build_scripted_response(self.inst, self.ch, self.usr, cfg, self.sess, "thanks"))
        assert captured["options"] == server.DEFAULT_ACK_REPLIES
        assert out == server.DEFAULT_ACK_REPLIES[0]

    def test_ai_mode_empty_acks_uses_defaults(self, monkeypatch, seed_counter):
        _run(seed_counter(self.inst, self.ch, self.usr, count=2))
        async def intent(*a, **kw): return "ack"
        captured = {}
        async def pick(user_text, options, session_id, instance_id):
            captured["options"] = list(options)
            return 1
        monkeypatch.setattr(server, "_classify_user_intent", intent)
        monkeypatch.setattr(server, "_ai_pick_variant", pick)

        cfg = _make_cfg(rephrase_mode="ai", acknowledgment_replies=[])
        out = _run(server.build_scripted_response(self.inst, self.ch, self.usr, cfg, self.sess, "thanks"))
        assert captured["options"] == server.DEFAULT_ACK_REPLIES
        assert out == server.DEFAULT_ACK_REPLIES[0]


# --------------------------------------------------------------------------- #
# GET/PUT /api/discord/config — acknowledgment_replies auto-seeding           #
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


class TestDiscordConfigAckSeeding:
    DEFAULTS = ["You're welcome!", "Anytime — happy to help!", "No problem!", "Glad I could help."]

    def _get_acks(self, H):
        r = requests.get(f"{BASE_URL}/api/discord/config", headers=H, timeout=20)
        assert r.status_code == 200, r.text
        return ((r.json().get("scripted_mode") or {}).get("acknowledgment_replies"))

    def test_missing_acks_get_seeded_with_defaults(self, H):
        # Wipe field first
        r = requests.put(f"{BASE_URL}/api/discord/config", headers=H, json={
            "scripted_mode": {"acknowledgment_replies": []}
        }, timeout=20)
        assert r.status_code == 200
        # Now GET — empty list should be treated as missing → defaults seeded
        acks = self._get_acks(H)
        assert acks == self.DEFAULTS

    def test_custom_acks_persist_and_no_default_override(self, H):
        custom = ["Cheers!", "You bet!"]
        r = requests.put(f"{BASE_URL}/api/discord/config", headers=H, json={
            "scripted_mode": {"acknowledgment_replies": custom}
        }, timeout=20)
        assert r.status_code == 200, r.text
        acks = self._get_acks(H)
        assert acks == custom

    def test_explicit_empty_seeds_defaults_again(self, H):
        # Set non-empty, then explicit empty list — defaults should re-seed on GET
        requests.put(f"{BASE_URL}/api/discord/config", headers=H, json={
            "scripted_mode": {"acknowledgment_replies": ["X", "Y"]}
        }, timeout=20)
        r = requests.put(f"{BASE_URL}/api/discord/config", headers=H, json={
            "scripted_mode": {"acknowledgment_replies": []}
        }, timeout=20)
        assert r.status_code == 200
        acks = self._get_acks(H)
        assert acks == self.DEFAULTS
