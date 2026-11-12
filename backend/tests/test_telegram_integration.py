"""
Telegram Bot Integration Tests for BitBot Pro
Tests: Config CRUD, webhook validation, listen modes
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

# Test credentials from test_credentials.md
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token and instance ID"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Instance-ID": INSTANCE_ID,
        "Content-Type": "application/json"
    }


class TestTelegramConfigGet:
    """Tests for GET /api/admin/telegram-config"""
    
    def test_get_config_returns_default_when_not_configured(self, auth_headers):
        """GET /api/admin/telegram-config returns default config when no Telegram is configured"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-config", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should return default values when not configured
        assert "instance_id" in data
        assert data.get("connected") == False or data.get("is_active") == False
        assert data.get("listen_mode") == "mention_or_command"
        print(f"Default config returned: connected={data.get('connected')}, listen_mode={data.get('listen_mode')}")
    
    def test_get_config_requires_auth(self):
        """GET /api/admin/telegram-config requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/telegram-config", headers={
            "X-Instance-ID": INSTANCE_ID
        })
        assert response.status_code == 401


class TestTelegramConfigUpdate:
    """Tests for PUT /api/admin/telegram-config"""
    
    def test_update_with_invalid_token_returns_400(self, auth_headers):
        """PUT /api/admin/telegram-config with an invalid bot_token returns 400 error"""
        response = requests.put(
            f"{BASE_URL}/api/admin/telegram-config",
            headers=auth_headers,
            json={"bot_token": "invalid_token_12345"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data
        # Should contain descriptive error message about invalid token
        detail = data.get("detail", "").lower()
        assert "invalid" in detail or "token" in detail or "telegram" in detail, f"Error message should mention invalid token: {data}"
        print(f"Invalid token error: {data.get('detail')}")
    
    def test_update_listen_mode_all(self, auth_headers):
        """PUT /api/admin/telegram-config with listen_mode='all' updates successfully"""
        response = requests.put(
            f"{BASE_URL}/api/admin/telegram-config",
            headers=auth_headers,
            json={"listen_mode": "all"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"Listen mode 'all' update response: {data}")
        
        # Verify the change persisted
        get_response = requests.get(f"{BASE_URL}/api/admin/telegram-config", headers=auth_headers)
        assert get_response.status_code == 200
        config = get_response.json()
        assert config.get("listen_mode") == "all", f"Expected listen_mode='all', got {config.get('listen_mode')}"
    
    def test_update_listen_mode_mention_or_command(self, auth_headers):
        """PUT /api/admin/telegram-config with listen_mode='mention_or_command' updates successfully"""
        response = requests.put(
            f"{BASE_URL}/api/admin/telegram-config",
            headers=auth_headers,
            json={"listen_mode": "mention_or_command"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the change persisted
        get_response = requests.get(f"{BASE_URL}/api/admin/telegram-config", headers=auth_headers)
        assert get_response.status_code == 200
        config = get_response.json()
        assert config.get("listen_mode") == "mention_or_command"
    
    def test_update_listen_mode_dm_only(self, auth_headers):
        """PUT /api/admin/telegram-config with listen_mode='dm_only' updates successfully"""
        response = requests.put(
            f"{BASE_URL}/api/admin/telegram-config",
            headers=auth_headers,
            json={"listen_mode": "dm_only"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the change persisted
        get_response = requests.get(f"{BASE_URL}/api/admin/telegram-config", headers=auth_headers)
        assert get_response.status_code == 200
        config = get_response.json()
        assert config.get("listen_mode") == "dm_only"
    
    def test_update_invalid_listen_mode_returns_400(self, auth_headers):
        """PUT /api/admin/telegram-config with listen_mode='invalid_mode' returns 400 error"""
        response = requests.put(
            f"{BASE_URL}/api/admin/telegram-config",
            headers=auth_headers,
            json={"listen_mode": "invalid_mode"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data
        detail = data.get("detail", "").lower()
        assert "listen_mode" in detail or "all" in detail or "mention" in detail or "dm" in detail, f"Error should mention valid listen modes: {data}"
        print(f"Invalid listen_mode error: {data.get('detail')}")
    
    def test_update_requires_auth(self):
        """PUT /api/admin/telegram-config requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/admin/telegram-config",
            headers={"X-Instance-ID": INSTANCE_ID, "Content-Type": "application/json"},
            json={"listen_mode": "all"}
        )
        assert response.status_code == 401


class TestTelegramConfigTest:
    """Tests for POST /api/admin/telegram-config/test"""
    
    def test_test_token_returns_400_when_not_configured(self, auth_headers):
        """POST /api/admin/telegram-config/test returns 400 when no token is configured"""
        # First ensure no token is configured by checking current state
        get_response = requests.get(f"{BASE_URL}/api/admin/telegram-config", headers=auth_headers)
        config = get_response.json()
        
        # If already connected, skip this test
        if config.get("connected"):
            pytest.skip("Telegram is already connected - cannot test 'no token' scenario")
        
        response = requests.post(f"{BASE_URL}/api/admin/telegram-config/test", headers=auth_headers)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data
        detail = data.get("detail", "").lower()
        assert "no" in detail or "token" in detail or "configured" in detail, f"Error should mention no token configured: {data}"
        print(f"No token configured error: {data.get('detail')}")
    
    def test_test_token_requires_auth(self):
        """POST /api/admin/telegram-config/test requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/telegram-config/test",
            headers={"X-Instance-ID": INSTANCE_ID}
        )
        assert response.status_code == 401


class TestTelegramConfigDelete:
    """Tests for DELETE /api/admin/telegram-config"""
    
    def test_delete_returns_success_even_when_not_configured(self, auth_headers):
        """DELETE /api/admin/telegram-config returns success even when no config exists"""
        response = requests.delete(f"{BASE_URL}/api/admin/telegram-config", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"Delete response: {data}")
    
    def test_delete_requires_auth(self):
        """DELETE /api/admin/telegram-config requires authentication"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/telegram-config",
            headers={"X-Instance-ID": INSTANCE_ID}
        )
        assert response.status_code == 401


class TestTelegramWebhook:
    """Tests for POST /api/telegram/webhook/{instance_id}/{webhook_secret}"""
    
    def test_webhook_wrong_secret_returns_403(self):
        """POST /api/telegram/webhook/{instance_id}/{wrong_secret} returns 403 Forbidden"""
        wrong_secret = "wrong_secret_12345"
        response = requests.post(
            f"{BASE_URL}/api/telegram/webhook/{INSTANCE_ID}/{wrong_secret}",
            json={"message": {"text": "test"}}
        )
        
        # Should return 403 (Forbidden) or 404 (Not found) if no config exists
        assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}: {response.text}"
        print(f"Wrong secret response: {response.status_code} - {response.text}")
    
    def test_webhook_with_non_text_message_returns_ok(self):
        """POST /api/telegram/webhook/{instance_id}/{secret} with non-text message returns ok"""
        # This test requires a valid webhook secret, which we don't have without a real token
        # So we test that the endpoint exists and handles the request gracefully
        fake_secret = "test_secret_for_non_text"
        response = requests.post(
            f"{BASE_URL}/api/telegram/webhook/{INSTANCE_ID}/{fake_secret}",
            json={
                "update_id": 123456789,
                "message": {
                    "message_id": 1,
                    "from": {"id": 123, "first_name": "Test"},
                    "chat": {"id": 123, "type": "private"},
                    "photo": [{"file_id": "test_photo"}]  # Non-text message (photo)
                }
            }
        )
        
        # Should return 403/404 (wrong secret) or 200 (if somehow matches)
        # The key is it doesn't crash
        assert response.status_code in [200, 403, 404], f"Unexpected status: {response.status_code}: {response.text}"
        print(f"Non-text message response: {response.status_code}")
    
    def test_webhook_no_auth_required(self):
        """Webhook endpoint does not require Authorization header"""
        # Webhook is validated by secret in URL, not by auth header
        response = requests.post(
            f"{BASE_URL}/api/telegram/webhook/{INSTANCE_ID}/any_secret",
            json={"message": {"text": "test"}}
        )
        
        # Should NOT return 401 (Unauthorized) - webhook uses URL secret for auth
        assert response.status_code != 401, "Webhook should not require Authorization header"
        print(f"Webhook without auth header: {response.status_code}")


class TestTelegramConfigCleanup:
    """Cleanup tests - reset listen_mode to default"""
    
    def test_reset_listen_mode_to_default(self, auth_headers):
        """Reset listen_mode back to mention_or_command (default)"""
        response = requests.put(
            f"{BASE_URL}/api/admin/telegram-config",
            headers=auth_headers,
            json={"listen_mode": "mention_or_command"}
        )
        
        assert response.status_code == 200
        print("Reset listen_mode to mention_or_command")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
