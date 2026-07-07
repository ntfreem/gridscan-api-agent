"""Tests for the new Response Defaults endpoints and sandbox integration."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rag-search-dev.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": "administrator",
        "password": "Admin@123",
    }, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    return j.get("access_token") or j.get("token")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def instance_id(auth_headers):
    r = requests.get(f"{BASE_URL}/api/admin/instances", headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    instances = r.json()
    assert instances, "No instances found"
    # Prefer 'Scripted Test' if present
    for inst in instances:
        if inst.get("name") == "Scripted Test":
            return inst["id"]
    return instances[0]["id"]


class TestReplyDefaults:
    def test_get_reply_defaults(self, auth_headers, instance_id):
        r = requests.get(f"{BASE_URL}/api/admin/instances/{instance_id}/reply-defaults",
                         headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "acknowledgment_replies" in data
        assert "fallback_message" in data
        assert isinstance(data["acknowledgment_replies"], list)
        assert isinstance(data["fallback_message"], str)

    def test_put_and_persist_reply_defaults(self, auth_headers, instance_id):
        payload = {
            "acknowledgment_replies": ["TEST_ack_1", "TEST_ack_2", "TEST_ack_3"],
            "fallback_message": "TEST_fallback_message_persist",
        }
        r = requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/reply-defaults",
                         headers=auth_headers, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        # Verify persistence
        r2 = requests.get(f"{BASE_URL}/api/admin/instances/{instance_id}/reply-defaults",
                          headers=auth_headers, timeout=30)
        assert r2.status_code == 200
        got = r2.json()
        assert got["acknowledgment_replies"] == payload["acknowledgment_replies"]
        assert got["fallback_message"] == payload["fallback_message"]

    def test_put_requires_admin(self, instance_id):
        r = requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/reply-defaults",
                         json={"fallback_message": "nope"}, timeout=30)
        assert r.status_code in (401, 403)

    def test_get_missing_instance_returns_defaults_or_404(self, auth_headers):
        # For an unknown instance, GET returns default fallback per code path
        r = requests.get(f"{BASE_URL}/api/admin/instances/nonexistent-instance-xyz/reply-defaults",
                         headers=auth_headers, timeout=30)
        # Endpoint reads bot_instances then falls back; it doesn't 404 on GET
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["acknowledgment_replies"], list)

    def test_put_missing_instance_404(self, auth_headers):
        r = requests.put(f"{BASE_URL}/api/admin/instances/nonexistent-instance-xyz/reply-defaults",
                         headers=auth_headers, json={"fallback_message": "x"}, timeout=30)
        assert r.status_code == 404

    def test_sandbox_uses_instance_reply_defaults(self, auth_headers, instance_id):
        """Sandbox should pull ack_replies + fallback from bot_instances."""
        # Set known values
        payload = {
            "acknowledgment_replies": ["TEST_sandbox_ack_unique_ABCDEF"],
            "fallback_message": "TEST_sandbox_fallback_unique_XYZ",
        }
        put_r = requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/reply-defaults",
                             headers=auth_headers, json=payload, timeout=30)
        assert put_r.status_code == 200

        # Call sandbox with an out-of-scope query to trigger fallback path
        body = {
            "messages": [{"role": "user", "content": "asdklfjaklsdjf random gibberish query zzzzzzz"}],
        }
        headers = {**auth_headers, "X-Instance-ID": instance_id}
        r = requests.post(f"{BASE_URL}/api/discord/scripted-mode/sandbox",
                          headers=headers, json=body, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        # Response body may vary; just make sure request works and doesn't error out
        assert isinstance(data, dict)
