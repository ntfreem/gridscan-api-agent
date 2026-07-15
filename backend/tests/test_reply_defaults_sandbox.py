"""Tests for the reply-defaults / scripted-mode sandbox integration.

Verifies:
  * PUT/GET /api/admin/instances/{id}/reply-defaults persists custom ack_replies + fallback
  * POST /api/discord/scripted-mode/sandbox uses those custom ack_replies via
    _load_scripted_cfg (bot_instances merge) — pool_considered on ack turns
    reflects the saved custom list, not DEFAULT_ACK_REPLIES.
  * When custom ack_replies are removed, sandbox falls back to DEFAULT_ACK_REPLIES.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rag-search-dev.preview.emergentagent.com").rstrip("/")
INSTANCE_ID = "8292460c-de40-4a28-a711-640c0ecb8447"

DEFAULT_ACK_REPLIES = [
    "You're welcome!",
    "Anytime — happy to help!",
    "No problem!",
    "Glad I could help.",
]

CUSTOM_ACKS = ["Glad to help!", "No worries!", "Anytime!", "You got it!"]
CUSTOM_FALLBACK = "Please contact support for further help."


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_username": "administrator", "password": "Admin@123"},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {
        "Authorization": f"Bearer {admin_token}",
        "X-Instance-ID": INSTANCE_ID,
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="module")
def original_defaults(admin_headers):
    """Snapshot original reply-defaults so we restore them after tests."""
    r = requests.get(
        f"{BASE_URL}/api/admin/instances/{INSTANCE_ID}/reply-defaults",
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_01_get_reply_defaults_returns_custom_values(admin_headers, original_defaults):
    """GET returns the currently-saved custom ack_replies + fallback."""
    data = original_defaults
    assert "acknowledgment_replies" in data
    assert "fallback_message" in data
    # Per agent-context-note, the saved values on this instance are the CUSTOM_ACKS set.
    assert data["acknowledgment_replies"] == CUSTOM_ACKS, (
        f"Expected {CUSTOM_ACKS}, got {data['acknowledgment_replies']}"
    )
    assert data["fallback_message"] == CUSTOM_FALLBACK


def test_02_put_reply_defaults_persists(admin_headers, original_defaults):
    """PUT saves new values; subsequent GET returns them."""
    new_acks = ["Test-A!", "Test-B!", "Test-C!"]
    new_fallback = "TEST_fallback_msg"
    r = requests.put(
        f"{BASE_URL}/api/admin/instances/{INSTANCE_ID}/reply-defaults",
        headers=admin_headers,
        json={"acknowledgment_replies": new_acks, "fallback_message": new_fallback},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("success") is True

    r2 = requests.get(
        f"{BASE_URL}/api/admin/instances/{INSTANCE_ID}/reply-defaults",
        headers=admin_headers, timeout=15,
    )
    assert r2.status_code == 200
    data = r2.json()
    assert data["acknowledgment_replies"] == new_acks
    assert data["fallback_message"] == new_fallback

    # Restore to CUSTOM (or whatever original was) for the next test
    orig = original_defaults
    rr = requests.put(
        f"{BASE_URL}/api/admin/instances/{INSTANCE_ID}/reply-defaults",
        headers=admin_headers,
        json={
            "acknowledgment_replies": orig["acknowledgment_replies"],
            "fallback_message": orig["fallback_message"],
        },
        timeout=15,
    )
    assert rr.status_code == 200


def test_03_sandbox_uses_custom_ack_replies(admin_headers):
    """Sandbox turn 3 (thanks!) must show pool_name='ack' with CUSTOM_ACKS in pool_considered."""
    body = {"messages": ["question", "question", "thanks!"]}
    r = requests.post(
        f"{BASE_URL}/api/discord/scripted-mode/sandbox",
        headers=admin_headers, json=body, timeout=60,
    )
    assert r.status_code == 200, r.text
    turns = r.json().get("turns") or []
    assert len(turns) == 3, f"Expected 3 turns, got {len(turns)}: {turns}"
    t3 = turns[2]
    assert t3.get("pool_name") == "ack", (
        f"Turn 3 pool_name expected 'ack', got {t3.get('pool_name')} — full turn: {t3}"
    )
    assert t3.get("intent") == "ack", f"Turn 3 intent expected 'ack', got {t3.get('intent')}"
    pool = t3.get("pool_considered") or []
    # pool_considered is `unused` — a subset of CUSTOM_ACKS. Verify every element belongs to CUSTOM_ACKS.
    assert pool, f"pool_considered should be non-empty for ack turn: {t3}"
    for reply in pool:
        assert reply in CUSTOM_ACKS, (
            f"pool_considered contains '{reply}' which is NOT in CUSTOM_ACKS {CUSTOM_ACKS}. "
            f"Full pool: {pool}. This means sandbox is NOT reading from bot_instances."
        )
    # And the chosen reply must be one of the custom acks
    assert t3.get("bot_reply") in CUSTOM_ACKS, (
        f"bot_reply '{t3.get('bot_reply')}' not in CUSTOM_ACKS {CUSTOM_ACKS}"
    )


def test_04_sandbox_falls_back_to_defaults_when_empty(admin_headers, original_defaults):
    """If custom ack_replies are cleared on bot_instances, sandbox uses DEFAULT_ACK_REPLIES."""
    # Clear ack_replies on bot_instances
    r = requests.put(
        f"{BASE_URL}/api/admin/instances/{INSTANCE_ID}/reply-defaults",
        headers=admin_headers,
        json={"acknowledgment_replies": [], "fallback_message": ""},
        timeout=15,
    )
    assert r.status_code == 200, r.text

    try:
        body = {"messages": ["question", "question", "thanks!"]}
        r2 = requests.post(
            f"{BASE_URL}/api/discord/scripted-mode/sandbox",
            headers=admin_headers, json=body, timeout=60,
        )
        assert r2.status_code == 200, r2.text
        turns = r2.json().get("turns") or []
        assert len(turns) == 3
        t3 = turns[2]
        assert t3.get("pool_name") == "ack", (
            f"Turn 3 pool_name expected 'ack', got {t3.get('pool_name')}: {t3}"
        )
        pool = t3.get("pool_considered") or []
        assert pool, f"pool_considered empty on fallback: {t3}"
        # Every reply in pool must belong to DEFAULT_ACK_REPLIES
        for reply in pool:
            assert reply in DEFAULT_ACK_REPLIES, (
                f"Expected fallback to DEFAULT_ACK_REPLIES {DEFAULT_ACK_REPLIES}, "
                f"but pool_considered contains '{reply}'. Full pool: {pool}"
            )
        assert t3.get("bot_reply") in DEFAULT_ACK_REPLIES
    finally:
        # Restore original saved values
        orig = original_defaults
        requests.put(
            f"{BASE_URL}/api/admin/instances/{INSTANCE_ID}/reply-defaults",
            headers=admin_headers,
            json={
                "acknowledgment_replies": orig["acknowledgment_replies"],
                "fallback_message": orig["fallback_message"],
            },
            timeout=15,
        )


def test_05_get_defaults_restored(admin_headers, original_defaults):
    """After the cleanup in test_04, saved values must equal the original snapshot."""
    r = requests.get(
        f"{BASE_URL}/api/admin/instances/{INSTANCE_ID}/reply-defaults",
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["acknowledgment_replies"] == original_defaults["acknowledgment_replies"]
    assert data["fallback_message"] == original_defaults["fallback_message"]
