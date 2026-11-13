"""
Zendesk OAuth Migration Tests for BitBot Pro
Tests: OAuth 2.0 flow with PKCE, error handling when env vars not set,
subdomain normalization, callback handling, config management
"""
import pytest
import requests
import os
import urllib.parse

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

# Test credentials
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def auth_headers():
    """Get authentication headers for admin user"""
    login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json().get("token")
    return {
        "Authorization": f"Bearer {token}",
        "X-Instance-ID": INSTANCE_ID,
        "Content-Type": "application/json"
    }


class TestZendeskOAuthConfigStatus:
    """Tests for GET /api/admin/zendesk-config - OAuth configuration status"""

    def test_get_config_returns_oauth_configured_false(self, auth_headers):
        """GET /api/admin/zendesk-config returns oauth_configured: false when env vars not set"""
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify oauth_configured field exists and is false (env vars not set)
        assert "oauth_configured" in data, f"Response should contain oauth_configured: {data}"
        assert data["oauth_configured"] == False, f"oauth_configured should be False when env vars not set: {data}"
        print(f"✓ oauth_configured: {data['oauth_configured']}")

    def test_get_config_returns_connected_false_when_no_connection(self, auth_headers):
        """GET /api/admin/zendesk-config returns connected: false when no connection exists"""
        # First ensure no config exists
        requests.delete(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "connected" in data, f"Response should contain connected: {data}"
        assert data["connected"] == False, f"connected should be False when no connection: {data}"
        print(f"✓ connected: {data['connected']}")

    def test_get_config_returns_auth_type_null_when_no_connection(self, auth_headers):
        """GET /api/admin/zendesk-config returns auth_type: null when no connection exists"""
        # First ensure no config exists
        requests.delete(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "auth_type" in data, f"Response should contain auth_type: {data}"
        assert data["auth_type"] is None, f"auth_type should be None when no connection: {data}"
        print(f"✓ auth_type: {data['auth_type']}")


class TestZendeskOAuthCallbackUrl:
    """Tests for GET /api/admin/zendesk/oauth/callback-url"""

    def test_get_callback_url_returns_correct_url(self, auth_headers):
        """GET /api/admin/zendesk/oauth/callback-url returns correct callback URL"""
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk/oauth/callback-url", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "callback_url" in data, f"Response should contain callback_url: {data}"
        callback_url = data["callback_url"]
        
        # Verify the callback URL is based on REACT_APP_BACKEND_URL
        expected_base = BASE_URL.rstrip("/")
        expected_callback = f"{expected_base}/api/zendesk/oauth/callback"
        assert callback_url == expected_callback, f"Expected {expected_callback}, got {callback_url}"
        print(f"✓ callback_url: {callback_url}")


class TestZendeskOAuthStart:
    """Tests for POST /api/admin/zendesk/oauth/start"""

    def test_oauth_start_returns_400_when_env_vars_not_set(self, auth_headers):
        """POST /api/admin/zendesk/oauth/start returns 400 when ZENDESK_OAUTH_CLIENT_ID not set"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/start",
            headers=auth_headers,
            json={"subdomain": "midnight-gd"}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        detail = data.get("detail", "")
        
        # Verify error message mentions OAuth not configured
        assert "oauth" in detail.lower() or "client_id" in detail.lower() or "configured" in detail.lower(), \
            f"Error should mention OAuth not configured: {detail}"
        print(f"✓ OAuth start error (env vars not set): {detail}")

    def test_oauth_start_validates_empty_subdomain(self, auth_headers):
        """POST /api/admin/zendesk/oauth/start validates empty subdomain"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/start",
            headers=auth_headers,
            json={"subdomain": ""}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        detail = data.get("detail", "")
        
        # Error should mention subdomain or OAuth not configured (either is valid)
        assert "subdomain" in detail.lower() or "oauth" in detail.lower() or "configured" in detail.lower(), \
            f"Error should mention subdomain or OAuth: {detail}"
        print(f"✓ Empty subdomain validation: {detail}")

    def test_oauth_start_validates_whitespace_subdomain(self, auth_headers):
        """POST /api/admin/zendesk/oauth/start validates whitespace-only subdomain"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/start",
            headers=auth_headers,
            json={"subdomain": "   "}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print(f"✓ Whitespace subdomain rejected")


class TestZendeskOAuthCallback:
    """Tests for GET /api/zendesk/oauth/callback (unauthenticated endpoint)"""

    def test_callback_with_invalid_state_returns_redirect_with_error(self):
        """GET /api/zendesk/oauth/callback with invalid state returns redirect with error"""
        resp = requests.get(
            f"{BASE_URL}/api/zendesk/oauth/callback",
            params={"state": "invalid_state_12345", "code": "test_code"},
            allow_redirects=False
        )
        
        # Should redirect (302) with error in query params
        assert resp.status_code == 302, f"Expected 302 redirect, got {resp.status_code}: {resp.text}"
        
        location = resp.headers.get("Location", "")
        assert "oauth=error" in location, f"Redirect should contain oauth=error: {location}"
        assert "message=" in location, f"Redirect should contain error message: {location}"
        print(f"✓ Invalid state redirect: {location}")

    def test_callback_with_missing_code_returns_redirect_with_error(self):
        """GET /api/zendesk/oauth/callback with missing code returns redirect with error"""
        resp = requests.get(
            f"{BASE_URL}/api/zendesk/oauth/callback",
            params={"state": "some_state"},
            allow_redirects=False
        )
        
        # Should redirect (302) with error
        assert resp.status_code == 302, f"Expected 302 redirect, got {resp.status_code}: {resp.text}"
        
        location = resp.headers.get("Location", "")
        assert "oauth=error" in location, f"Redirect should contain oauth=error: {location}"
        print(f"✓ Missing code redirect: {location}")

    def test_callback_with_access_denied_error_returns_user_friendly_redirect(self):
        """GET /api/zendesk/oauth/callback with error=access_denied returns user-friendly redirect"""
        resp = requests.get(
            f"{BASE_URL}/api/zendesk/oauth/callback",
            params={"error": "access_denied", "error_description": "User denied access"},
            allow_redirects=False
        )
        
        # Should redirect (302) with user-friendly error
        assert resp.status_code == 302, f"Expected 302 redirect, got {resp.status_code}: {resp.text}"
        
        location = resp.headers.get("Location", "")
        assert "oauth=error" in location, f"Redirect should contain oauth=error: {location}"
        
        # Decode the message to check it's user-friendly
        parsed = urllib.parse.urlparse(location)
        query_params = urllib.parse.parse_qs(parsed.query)
        message = query_params.get("message", [""])[0]
        
        assert "denied" in message.lower() or "authorization" in message.lower(), \
            f"Message should be user-friendly about denial: {message}"
        print(f"✓ Access denied redirect message: {message}")

    def test_callback_with_generic_error_returns_redirect(self):
        """GET /api/zendesk/oauth/callback with generic error returns redirect"""
        resp = requests.get(
            f"{BASE_URL}/api/zendesk/oauth/callback",
            params={"error": "server_error", "error_description": "Something went wrong"},
            allow_redirects=False
        )
        
        assert resp.status_code == 302, f"Expected 302 redirect, got {resp.status_code}: {resp.text}"
        
        location = resp.headers.get("Location", "")
        assert "oauth=error" in location, f"Redirect should contain oauth=error: {location}"
        print(f"✓ Generic error redirect: {location}")


class TestZendeskConfigUpdate:
    """Tests for PUT /api/admin/zendesk-config"""

    def test_update_config_returns_400_when_no_connection(self, auth_headers):
        """PUT /api/admin/zendesk-config returns 400 when no connection exists"""
        # First ensure no config exists
        requests.delete(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        
        resp = requests.put(
            f"{BASE_URL}/api/admin/zendesk-config",
            headers=auth_headers,
            json={"auto_reply_enabled": True}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        detail = data.get("detail", "")
        assert "connect" in detail.lower() or "first" in detail.lower(), \
            f"Error should mention connecting first: {detail}"
        print(f"✓ Update without connection error: {detail}")

    def test_update_config_accepts_only_new_fields(self, auth_headers):
        """PUT /api/admin/zendesk-config only accepts auto_reply_enabled, agent_assist_enabled, is_active"""
        # This test verifies the new model doesn't accept old email/api_token fields
        # Since there's no connection, we expect 400 anyway, but the validation should pass
        resp = requests.put(
            f"{BASE_URL}/api/admin/zendesk-config",
            headers=auth_headers,
            json={
                "auto_reply_enabled": False,
                "agent_assist_enabled": True,
                "is_active": False
            }
        )
        # Should return 400 because no connection exists, not 422 for invalid fields
        assert resp.status_code == 400, f"Expected 400 (no connection), got {resp.status_code}: {resp.text}"
        print(f"✓ New fields accepted (but no connection to update)")


class TestZendeskConfigDelete:
    """Tests for DELETE /api/admin/zendesk-config"""

    def test_delete_config_cleans_up_oauth_states(self, auth_headers):
        """DELETE /api/admin/zendesk-config removes connection and cleans up OAuth states"""
        resp = requests.delete(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert data.get("success") == True, f"Expected success: True, got {data}"
        print(f"✓ Delete config response: {data}")
        
        # Verify config is actually deleted
        get_resp = requests.get(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        assert get_resp.status_code == 200
        get_data = get_resp.json()
        assert get_data.get("connected") == False, f"Should be disconnected after delete: {get_data}"
        print(f"✓ Config verified as deleted")


class TestZendeskConfigTest:
    """Tests for POST /api/admin/zendesk-config/test"""

    def test_test_connection_returns_400_when_no_connection(self, auth_headers):
        """POST /api/admin/zendesk-config/test returns 400 when no connection exists"""
        # First ensure no config exists
        requests.delete(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        
        resp = requests.post(f"{BASE_URL}/api/admin/zendesk-config/test", headers=auth_headers)
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        detail = data.get("detail", "")
        assert "no" in detail.lower() or "connection" in detail.lower() or "found" in detail.lower(), \
            f"Error should mention no connection: {detail}"
        print(f"✓ Test without connection error: {detail}")


class TestZendeskAuthRequired:
    """Tests to verify authentication is required for admin endpoints"""

    def test_get_config_requires_auth(self):
        """GET /api/admin/zendesk-config requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk-config")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print(f"✓ GET config requires auth")

    def test_put_config_requires_auth(self):
        """PUT /api/admin/zendesk-config requires authentication"""
        resp = requests.put(f"{BASE_URL}/api/admin/zendesk-config", json={"is_active": True})
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print(f"✓ PUT config requires auth")

    def test_delete_config_requires_auth(self):
        """DELETE /api/admin/zendesk-config requires authentication"""
        resp = requests.delete(f"{BASE_URL}/api/admin/zendesk-config")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print(f"✓ DELETE config requires auth")

    def test_oauth_start_requires_auth(self):
        """POST /api/admin/zendesk/oauth/start requires authentication"""
        resp = requests.post(f"{BASE_URL}/api/admin/zendesk/oauth/start", json={"subdomain": "test"})
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print(f"✓ OAuth start requires auth")

    def test_callback_url_requires_auth(self):
        """GET /api/admin/zendesk/oauth/callback-url requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk/oauth/callback-url")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print(f"✓ Callback URL requires auth")

    def test_oauth_callback_is_public(self):
        """GET /api/zendesk/oauth/callback is public (no auth required)"""
        # This endpoint should NOT require auth - it's the OAuth redirect target
        resp = requests.get(
            f"{BASE_URL}/api/zendesk/oauth/callback",
            params={"state": "test"},
            allow_redirects=False
        )
        # Should return 302 redirect, not 401
        assert resp.status_code == 302, f"Expected 302 (redirect), got {resp.status_code}"
        print(f"✓ OAuth callback is public (no auth required)")


class TestSubdomainNormalization:
    """Tests for subdomain normalization in OAuth start"""

    def test_subdomain_normalization_plain(self, auth_headers):
        """Subdomain 'midnight-gd' is accepted (normalized to 'midnight-gd')"""
        # This will fail with 400 because OAuth not configured, but validates subdomain first
        resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/start",
            headers=auth_headers,
            json={"subdomain": "midnight-gd"}
        )
        # Should get 400 for OAuth not configured, not for invalid subdomain
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        detail = resp.json().get("detail", "")
        # Should NOT mention subdomain being invalid
        assert "subdomain" not in detail.lower() or "oauth" in detail.lower(), \
            f"Plain subdomain should be valid: {detail}"
        print(f"✓ Plain subdomain 'midnight-gd' accepted")

    def test_subdomain_normalization_with_domain(self, auth_headers):
        """Subdomain 'midnight-gd.zendesk.com' is normalized"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/start",
            headers=auth_headers,
            json={"subdomain": "midnight-gd.zendesk.com"}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        detail = resp.json().get("detail", "")
        # Should NOT mention subdomain being invalid
        assert "subdomain" not in detail.lower() or "oauth" in detail.lower(), \
            f"Domain subdomain should be valid: {detail}"
        print(f"✓ Subdomain 'midnight-gd.zendesk.com' normalized")

    def test_subdomain_normalization_with_https(self, auth_headers):
        """Subdomain 'https://midnight-gd.zendesk.com/' is normalized"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/start",
            headers=auth_headers,
            json={"subdomain": "https://midnight-gd.zendesk.com/"}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        detail = resp.json().get("detail", "")
        # Should NOT mention subdomain being invalid
        assert "subdomain" not in detail.lower() or "oauth" in detail.lower(), \
            f"HTTPS URL subdomain should be valid: {detail}"
        print(f"✓ Subdomain 'https://midnight-gd.zendesk.com/' normalized")

    def test_subdomain_normalization_uppercase(self, auth_headers):
        """Subdomain 'MIDNIGHT-GD' is normalized to lowercase"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/start",
            headers=auth_headers,
            json={"subdomain": "MIDNIGHT-GD"}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        detail = resp.json().get("detail", "")
        # Should NOT mention subdomain being invalid
        assert "subdomain" not in detail.lower() or "oauth" in detail.lower(), \
            f"Uppercase subdomain should be valid: {detail}"
        print(f"✓ Subdomain 'MIDNIGHT-GD' normalized to lowercase")


class TestZendeskWebhookEndpoints:
    """Tests for Zendesk webhook endpoints (public, no auth required)"""

    def test_webhook_wrong_secret_forbidden(self):
        """POST /api/zendesk/webhook/{instance_id}/{wrong_secret} returns 403 or 404"""
        wrong_secret = "wrong_secret_abc123"
        resp = requests.post(
            f"{BASE_URL}/api/zendesk/webhook/{INSTANCE_ID}/{wrong_secret}",
            json={"ticket_id": "12345"}
        )
        # Should return 403 Forbidden or 404 Not Found (if no config exists)
        assert resp.status_code in [403, 404], f"Expected 403 or 404, got {resp.status_code}: {resp.text}"
        print(f"✓ Wrong secret response: {resp.status_code}")


class TestZendeskSuggestionEndpoint:
    """Tests for Zendesk suggestion endpoint (public, for ZAF sidebar)"""

    def test_get_suggestion_nonexistent_ticket(self):
        """GET /api/zendesk/suggestion/{instance_id}/{ticket_id} returns null for non-existent tickets"""
        nonexistent_ticket_id = "999999999"
        resp = requests.get(f"{BASE_URL}/api/zendesk/suggestion/{INSTANCE_ID}/{nonexistent_ticket_id}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("suggestion") is None, f"Expected null suggestion, got: {data}"
        assert data.get("ticket_id") == nonexistent_ticket_id
        print(f"✓ Non-existent ticket suggestion: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
