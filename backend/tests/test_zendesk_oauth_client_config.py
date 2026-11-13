"""
Zendesk OAuth Client Config Tests for BitBot Pro
Tests: In-app UI for Zendesk OAuth client configuration
- Admin can enter Client ID and Client Secret directly in the Zendesk settings page
- After saving, the page transitions to show the subdomain + 'Connect with Zendesk' form
- Admin can also remove the stored credentials
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

# Test credentials
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"

# Test OAuth client credentials (fake values for testing)
TEST_CLIENT_ID = "TEST_bitbotpro_oauth_client"
TEST_CLIENT_SECRET = "TEST_secret_abc123xyz789"


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


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_credentials(auth_headers):
    """Clean up test credentials before and after tests"""
    # Clean up before tests
    requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
    yield
    # Clean up after tests
    requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)


class TestGetOAuthClientConfig:
    """Tests for GET /api/admin/zendesk/oauth/client-config"""

    def test_get_client_config_returns_configured_false_when_no_credentials(self, auth_headers):
        """GET /api/admin/zendesk/oauth/client-config returns configured:false when no credentials are stored"""
        # First ensure no credentials exist
        requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "configured" in data, f"Response should contain 'configured': {data}"
        assert data["configured"] == False, f"configured should be False when no credentials: {data}"
        print(f"✓ configured: {data['configured']} (no credentials stored)")

    def test_get_client_config_returns_empty_masked_id_when_no_credentials(self, auth_headers):
        """GET /api/admin/zendesk/oauth/client-config returns empty client_id_masked when no credentials"""
        # First ensure no credentials exist
        requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert "client_id_masked" in data, f"Response should contain 'client_id_masked': {data}"
        # When no credentials, masked should be empty string
        assert data["client_id_masked"] == "", f"client_id_masked should be empty: {data}"
        print(f"✓ client_id_masked: '{data['client_id_masked']}' (empty when no credentials)")

    def test_get_client_config_requires_auth(self):
        """GET /api/admin/zendesk/oauth/client-config requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk/oauth/client-config")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print(f"✓ GET client-config requires auth")


class TestSaveOAuthClientConfig:
    """Tests for POST /api/admin/zendesk/oauth/client-config"""

    def test_save_client_config_success(self, auth_headers):
        """POST /api/admin/zendesk/oauth/client-config saves OAuth client credentials and returns success"""
        # First ensure no credentials exist
        requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        
        resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": TEST_CLIENT_ID,
                "client_secret": TEST_CLIENT_SECRET
            }
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data.get("success") == True, f"Expected success: True, got {data}"
        assert "message" in data, f"Response should contain message: {data}"
        print(f"✓ Save credentials response: {data}")

    def test_save_client_config_persists_credentials(self, auth_headers):
        """POST /api/admin/zendesk/oauth/client-config persists credentials (verified via GET)"""
        # First ensure no credentials exist
        requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        
        # Save credentials
        save_resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": TEST_CLIENT_ID,
                "client_secret": TEST_CLIENT_SECRET
            }
        )
        assert save_resp.status_code == 200, f"Save failed: {save_resp.text}"
        
        # Verify via GET
        get_resp = requests.get(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        assert get_resp.status_code == 200, f"GET failed: {get_resp.text}"
        data = get_resp.json()
        
        assert data["configured"] == True, f"configured should be True after saving: {data}"
        print(f"✓ Credentials persisted, configured: {data['configured']}")

    def test_save_client_config_returns_masked_client_id(self, auth_headers):
        """GET /api/admin/zendesk/oauth/client-config returns masked client_id after saving"""
        # First ensure no credentials exist
        requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        
        # Save credentials
        save_resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": TEST_CLIENT_ID,
                "client_secret": TEST_CLIENT_SECRET
            }
        )
        assert save_resp.status_code == 200, f"Save failed: {save_resp.text}"
        
        # Verify masked client_id
        get_resp = requests.get(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        assert get_resp.status_code == 200, f"GET failed: {get_resp.text}"
        data = get_resp.json()
        
        # Masked should show first 4 chars + ***
        expected_masked = f"{TEST_CLIENT_ID[:4]}***"
        assert data["client_id_masked"] == expected_masked, \
            f"Expected masked '{expected_masked}', got '{data['client_id_masked']}'"
        print(f"✓ client_id_masked: {data['client_id_masked']}")

    def test_save_client_config_rejects_empty_client_id(self, auth_headers):
        """POST /api/admin/zendesk/oauth/client-config rejects empty client_id"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": "",
                "client_secret": TEST_CLIENT_SECRET
            }
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print(f"✓ Empty client_id rejected")

    def test_save_client_config_rejects_empty_client_secret(self, auth_headers):
        """POST /api/admin/zendesk/oauth/client-config rejects empty client_secret"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": TEST_CLIENT_ID,
                "client_secret": ""
            }
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print(f"✓ Empty client_secret rejected")

    def test_save_client_config_rejects_whitespace_only(self, auth_headers):
        """POST /api/admin/zendesk/oauth/client-config rejects whitespace-only values"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": "   ",
                "client_secret": "   "
            }
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print(f"✓ Whitespace-only values rejected")

    def test_save_client_config_requires_auth(self):
        """POST /api/admin/zendesk/oauth/client-config requires authentication"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            json={
                "client_id": TEST_CLIENT_ID,
                "client_secret": TEST_CLIENT_SECRET
            }
        )
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print(f"✓ POST client-config requires auth")


class TestDeleteOAuthClientConfig:
    """Tests for DELETE /api/admin/zendesk/oauth/client-config"""

    def test_delete_client_config_success(self, auth_headers):
        """DELETE /api/admin/zendesk/oauth/client-config removes stored credentials"""
        # First save credentials
        requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": TEST_CLIENT_ID,
                "client_secret": TEST_CLIENT_SECRET
            }
        )
        
        # Delete credentials
        resp = requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data.get("success") == True, f"Expected success: True, got {data}"
        print(f"✓ Delete credentials response: {data}")

    def test_delete_client_config_verified_via_get(self, auth_headers):
        """DELETE /api/admin/zendesk/oauth/client-config - verify removal via GET"""
        # First save credentials
        requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": TEST_CLIENT_ID,
                "client_secret": TEST_CLIENT_SECRET
            }
        )
        
        # Delete credentials
        del_resp = requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        assert del_resp.status_code == 200, f"Delete failed: {del_resp.text}"
        
        # Verify via GET
        get_resp = requests.get(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        assert get_resp.status_code == 200, f"GET failed: {get_resp.text}"
        data = get_resp.json()
        
        assert data["configured"] == False, f"configured should be False after delete: {data}"
        print(f"✓ Credentials removed, configured: {data['configured']}")

    def test_delete_client_config_requires_auth(self):
        """DELETE /api/admin/zendesk/oauth/client-config requires authentication"""
        resp = requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
        print(f"✓ DELETE client-config requires auth")


class TestZendeskConfigOAuthConfiguredField:
    """Tests for oauth_configured field in GET /api/admin/zendesk-config"""

    def test_zendesk_config_returns_oauth_configured_true_after_save(self, auth_headers):
        """GET /api/admin/zendesk-config returns oauth_configured:true after credentials are saved"""
        # First ensure no credentials exist
        requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        
        # Save credentials
        save_resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": TEST_CLIENT_ID,
                "client_secret": TEST_CLIENT_SECRET
            }
        )
        assert save_resp.status_code == 200, f"Save failed: {save_resp.text}"
        
        # Check zendesk-config
        config_resp = requests.get(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        assert config_resp.status_code == 200, f"GET config failed: {config_resp.text}"
        data = config_resp.json()
        
        assert "oauth_configured" in data, f"Response should contain oauth_configured: {data}"
        assert data["oauth_configured"] == True, f"oauth_configured should be True: {data}"
        print(f"✓ zendesk-config oauth_configured: {data['oauth_configured']}")

    def test_zendesk_config_returns_oauth_configured_false_after_delete(self, auth_headers):
        """GET /api/admin/zendesk-config returns oauth_configured:false after credentials are removed"""
        # First save credentials
        requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": TEST_CLIENT_ID,
                "client_secret": TEST_CLIENT_SECRET
            }
        )
        
        # Delete credentials
        del_resp = requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        assert del_resp.status_code == 200, f"Delete failed: {del_resp.text}"
        
        # Check zendesk-config
        config_resp = requests.get(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        assert config_resp.status_code == 200, f"GET config failed: {config_resp.text}"
        data = config_resp.json()
        
        assert data["oauth_configured"] == False, f"oauth_configured should be False: {data}"
        print(f"✓ zendesk-config oauth_configured: {data['oauth_configured']} (after delete)")


class TestOAuthStartWithDBCredentials:
    """Tests for POST /api/admin/zendesk/oauth/start when credentials are stored in DB"""

    def test_oauth_start_works_with_db_credentials(self, auth_headers):
        """POST /api/admin/zendesk/oauth/start works when credentials are stored in DB (not env vars)"""
        # First ensure no credentials exist
        requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        
        # Save credentials to DB
        save_resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": TEST_CLIENT_ID,
                "client_secret": TEST_CLIENT_SECRET
            }
        )
        assert save_resp.status_code == 200, f"Save failed: {save_resp.text}"
        
        # Try to start OAuth flow
        start_resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/start",
            headers=auth_headers,
            json={"subdomain": "test-company"}
        )
        
        # Should return 200 with redirect_url (not 400 for missing credentials)
        assert start_resp.status_code == 200, f"Expected 200, got {start_resp.status_code}: {start_resp.text}"
        data = start_resp.json()
        
        assert "redirect_url" in data, f"Response should contain redirect_url: {data}"
        assert "subdomain" in data, f"Response should contain subdomain: {data}"
        
        # Verify the redirect URL contains the test client_id
        redirect_url = data["redirect_url"]
        assert TEST_CLIENT_ID in redirect_url, f"redirect_url should contain client_id: {redirect_url}"
        assert "test-company.zendesk.com" in redirect_url, f"redirect_url should contain subdomain: {redirect_url}"
        print(f"✓ OAuth start works with DB credentials")
        print(f"  redirect_url: {redirect_url[:100]}...")

    def test_oauth_start_fails_without_credentials(self, auth_headers):
        """POST /api/admin/zendesk/oauth/start fails when no credentials are stored"""
        # First ensure no credentials exist
        requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        
        # Try to start OAuth flow
        start_resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/start",
            headers=auth_headers,
            json={"subdomain": "test-company"}
        )
        
        # Should return 400 with error about missing credentials
        assert start_resp.status_code == 400, f"Expected 400, got {start_resp.status_code}: {start_resp.text}"
        data = start_resp.json()
        detail = data.get("detail", "")
        
        assert "oauth" in detail.lower() or "client" in detail.lower() or "configured" in detail.lower(), \
            f"Error should mention OAuth not configured: {detail}"
        print(f"✓ OAuth start fails without credentials: {detail}")


class TestShortClientIdMasking:
    """Tests for edge cases in client_id masking"""

    def test_short_client_id_masking(self, auth_headers):
        """Short client_id (<=4 chars) is masked as '***'"""
        # First ensure no credentials exist
        requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        
        # Save short client_id
        save_resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": "abc",
                "client_secret": TEST_CLIENT_SECRET
            }
        )
        assert save_resp.status_code == 200, f"Save failed: {save_resp.text}"
        
        # Verify masking
        get_resp = requests.get(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        assert get_resp.status_code == 200, f"GET failed: {get_resp.text}"
        data = get_resp.json()
        
        # Short client_id should be masked as "***"
        assert data["client_id_masked"] == "***", f"Short client_id should be masked as '***': {data}"
        print(f"✓ Short client_id masked as: {data['client_id_masked']}")

    def test_exactly_4_char_client_id_masking(self, auth_headers):
        """Exactly 4-char client_id is masked as '***'"""
        # First ensure no credentials exist
        requests.delete(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        
        # Save 4-char client_id
        save_resp = requests.post(
            f"{BASE_URL}/api/admin/zendesk/oauth/client-config",
            headers=auth_headers,
            json={
                "client_id": "abcd",
                "client_secret": TEST_CLIENT_SECRET
            }
        )
        assert save_resp.status_code == 200, f"Save failed: {save_resp.text}"
        
        # Verify masking
        get_resp = requests.get(f"{BASE_URL}/api/admin/zendesk/oauth/client-config", headers=auth_headers)
        assert get_resp.status_code == 200, f"GET failed: {get_resp.text}"
        data = get_resp.json()
        
        # 4-char client_id should be masked as "***" (not "abcd***")
        assert data["client_id_masked"] == "***", f"4-char client_id should be masked as '***': {data}"
        print(f"✓ 4-char client_id masked as: {data['client_id_masked']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
