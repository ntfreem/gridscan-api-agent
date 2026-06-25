"""Tests for /api/discord/app-config endpoints — verifies bug fix that
get_discord_credentials() no longer falls back to .env values once cleared."""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD,
    })
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# --- helpers ---------------------------------------------------------------

def _clear(headers, clear_connections=False):
    return requests.delete(
        f"{BASE_URL}/api/discord/app-config",
        headers=headers,
        params={"clear_connections": str(clear_connections).lower()},
    )

def _get(headers):
    return requests.get(f"{BASE_URL}/api/discord/app-config", headers=headers)

def _put(headers, body):
    return requests.put(f"{BASE_URL}/api/discord/app-config", headers=headers, json=body)


# --- tests -----------------------------------------------------------------

class TestDiscordAppConfigBugFix:
    """Bug fix: cleared credentials must NOT come back from .env fallback."""

    def test_01_login(self, auth_headers):
        assert "Authorization" in auth_headers

    def test_02_clear_then_get_returns_all_false(self, auth_headers):
        """After clearing DB, GET must report all has_* flags as False
        even though .env still has DISCORD_CLIENT_ID/SECRET/REDIRECT_URI/BOT_TOKEN set."""
        clear_resp = _clear(auth_headers)
        assert clear_resp.status_code == 200, clear_resp.text
        assert clear_resp.json().get("success") is True

        r = _get(auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["has_client_id"] is False, f"Leaked from env! client_id={data}"
        assert data["has_client_secret"] is False, f"Leaked from env! secret={data}"
        assert data["has_redirect_uri"] is False, f"Leaked from env! redirect={data}"
        assert data["has_bot_token"] is False, f"Leaked from env! bot_token={data}"
        # Masked values should also be empty strings
        assert data["client_id"] == "", f"client_id should be empty, got {data['client_id']!r}"
        assert data["client_secret"] == "", f"client_secret should be empty, got {data['client_secret']!r}"
        assert data["redirect_uri"] == "", f"redirect_uri should be empty, got {data['redirect_uri']!r}"
        assert data["bot_token"] == "", f"bot_token should be empty, got {data['bot_token']!r}"

    def test_03_clear_is_idempotent(self, auth_headers):
        """Hitting DELETE again when DB is already empty must still succeed."""
        r = _clear(auth_headers)
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True
        # And GET still shows everything false
        g = _get(auth_headers)
        assert g.status_code == 200
        d = g.json()
        assert not (d["has_client_id"] or d["has_client_secret"] or d["has_redirect_uri"] or d["has_bot_token"])

    def test_04_put_then_get_reflects_saved_values(self, auth_headers):
        """PUT should persist values, and the masked GET response must reflect
        what was JUST saved (not the .env value)."""
        payload = {
            "client_id": "TEST_CLIENT_ID_999",
            "client_secret": "TEST_secret_value_abcdLAST",
            "redirect_uri": "https://test.example.com/api/discord/callback",
            "bot_token": "TEST_bot_token_value_xyzwTAIL",
        }
        p = _put(auth_headers, payload)
        assert p.status_code == 200, p.text
        assert p.json().get("success") is True

        r = _get(auth_headers)
        assert r.status_code == 200
        d = r.json()
        # has_* flags must be true
        assert d["has_client_id"] is True
        assert d["has_client_secret"] is True
        assert d["has_redirect_uri"] is True
        assert d["has_bot_token"] is True
        # client_id and redirect_uri are NOT masked, must match exactly
        assert d["client_id"] == payload["client_id"], f"client_id mismatch: {d['client_id']!r}"
        assert d["redirect_uri"] == payload["redirect_uri"], f"redirect_uri mismatch: {d['redirect_uri']!r}"
        # secrets are masked as "***" + last 4 chars
        assert d["client_secret"].endswith("LAST"), f"masked secret tail wrong: {d['client_secret']!r}"
        assert d["client_secret"].startswith("***"), f"masked secret prefix wrong: {d['client_secret']!r}"
        assert d["bot_token"].endswith("TAIL"), f"masked token tail wrong: {d['bot_token']!r}"
        assert d["bot_token"].startswith("***"), f"masked token prefix wrong: {d['bot_token']!r}"
        # updated_at should be set
        assert d.get("updated_at"), "updated_at should be populated"

    def test_05_clear_again_returns_to_empty_state(self, auth_headers):
        """Clearing once more should drop the just-saved test credentials."""
        r = _clear(auth_headers)
        assert r.status_code == 200, r.text
        g = _get(auth_headers)
        d = g.json()
        assert d["has_client_id"] is False
        assert d["has_client_secret"] is False
        assert d["has_redirect_uri"] is False
        assert d["has_bot_token"] is False
        # And critically NOT the .env value either
        env_client_id = os.environ.get("DISCORD_CLIENT_ID", "")
        if env_client_id:
            assert d["client_id"] != env_client_id, (
                f".env DISCORD_CLIENT_ID ({env_client_id!r}) is leaking into API response!"
            )

    def test_06_clear_with_connections_flag_returns_count(self, auth_headers):
        """DELETE with clear_connections=true must return connections_cleared field."""
        r = _clear(auth_headers, clear_connections=True)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "connections_cleared" in body
        assert isinstance(body["connections_cleared"], int)
        assert body["connections_cleared"] >= 0

    def test_07_unauthenticated_get_blocked(self):
        r = requests.get(f"{BASE_URL}/api/discord/app-config")
        assert r.status_code in (401, 403), f"Expected auth required, got {r.status_code}"

    def test_08_unauthenticated_delete_blocked(self):
        r = requests.delete(f"{BASE_URL}/api/discord/app-config")
        assert r.status_code in (401, 403), f"Expected auth required, got {r.status_code}"
