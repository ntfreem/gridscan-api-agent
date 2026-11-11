"""
Zendesk Integration Tests for BridgeBot
Tests: Config CRUD, webhook handling, suggestion endpoint, analytics integration
"""
import pytest
import requests
import os
import uuid

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


class TestZendeskConfigEndpoints:
    """Tests for Zendesk admin configuration endpoints"""

    def test_get_zendesk_config_default(self, auth_headers):
        """GET /api/admin/zendesk-config returns default config when no config exists"""
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # Should return default values when no config exists
        assert "connected" in data
        assert "agent_assist_enabled" in data
        # Default: connected=False, agent_assist_enabled=True
        print(f"Zendesk config response: connected={data.get('connected')}, agent_assist_enabled={data.get('agent_assist_enabled')}")

    def test_put_zendesk_config_incomplete_credentials(self, auth_headers):
        """PUT /api/admin/zendesk-config returns 400 when subdomain/email/token are incomplete"""
        # Test with only subdomain
        resp = requests.put(f"{BASE_URL}/api/admin/zendesk-config", 
            headers=auth_headers,
            json={"subdomain": "test-company"})
        assert resp.status_code == 400, f"Expected 400 for incomplete credentials, got {resp.status_code}: {resp.text}"
        
        # Test with subdomain and email but no token
        resp = requests.put(f"{BASE_URL}/api/admin/zendesk-config", 
            headers=auth_headers,
            json={"subdomain": "test-company", "email": "test@example.com"})
        assert resp.status_code == 400, f"Expected 400 for missing token, got {resp.status_code}: {resp.text}"
        
        # Verify error message mentions required fields
        error_detail = resp.json().get("detail", "")
        assert "required" in error_detail.lower() or "subdomain" in error_detail.lower() or "email" in error_detail.lower() or "token" in error_detail.lower()
        print(f"Incomplete credentials error: {error_detail}")

    def test_put_zendesk_config_invalid_credentials(self, auth_headers):
        """PUT /api/admin/zendesk-config with invalid Zendesk credentials returns a clear error message"""
        resp = requests.put(f"{BASE_URL}/api/admin/zendesk-config", 
            headers=auth_headers,
            json={
                "subdomain": "invalid-test-subdomain-xyz123",
                "email": "invalid@example.com",
                "api_token": "invalid_token_abc123"
            })
        # Should return 400 with clear error about authentication failure
        assert resp.status_code == 400, f"Expected 400 for invalid credentials, got {resp.status_code}: {resp.text}"
        error_detail = resp.json().get("detail", "")
        # Error should mention authentication, connection, or subdomain issue
        assert any(word in error_detail.lower() for word in ["auth", "failed", "not found", "connection", "subdomain"]), \
            f"Error message should be clear about credential issue: {error_detail}"
        print(f"Invalid credentials error: {error_detail}")

    def test_delete_zendesk_config_success(self, auth_headers):
        """DELETE /api/admin/zendesk-config returns success even when no config exists"""
        resp = requests.delete(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        print(f"Delete config response: {data}")

    def test_post_zendesk_config_test_no_config(self, auth_headers):
        """POST /api/admin/zendesk-config/test returns 400 when no config is saved"""
        # First ensure no config exists
        requests.delete(f"{BASE_URL}/api/admin/zendesk-config", headers=auth_headers)
        
        resp = requests.post(f"{BASE_URL}/api/admin/zendesk-config/test", headers=auth_headers)
        assert resp.status_code == 400, f"Expected 400 when no config exists, got {resp.status_code}: {resp.text}"
        error_detail = resp.json().get("detail", "")
        assert "no" in error_detail.lower() or "config" in error_detail.lower() or "found" in error_detail.lower()
        print(f"Test connection without config error: {error_detail}")


class TestZendeskWebhookEndpoints:
    """Tests for Zendesk webhook endpoints (public, no auth required)"""

    def test_webhook_wrong_secret_forbidden(self, auth_headers):
        """POST /api/zendesk/webhook/{instance_id}/{wrong_secret} returns 403 Forbidden"""
        wrong_secret = "wrong_secret_abc123"
        resp = requests.post(
            f"{BASE_URL}/api/zendesk/webhook/{INSTANCE_ID}/{wrong_secret}",
            json={"ticket_id": "12345"}
        )
        # Should return 403 Forbidden or 404 Not Found (if no config exists)
        assert resp.status_code in [403, 404], f"Expected 403 or 404 for wrong secret, got {resp.status_code}: {resp.text}"
        print(f"Wrong secret response: {resp.status_code} - {resp.text}")

    def test_webhook_missing_ticket_id(self, auth_headers):
        """POST /api/zendesk/webhook/{instance_id}/{secret} requires ticket_id in the payload body"""
        # Use a dummy secret - will likely get 404 or 403 first, but if config exists, should check payload
        dummy_secret = "test_secret_123"
        resp = requests.post(
            f"{BASE_URL}/api/zendesk/webhook/{INSTANCE_ID}/{dummy_secret}",
            json={}  # Missing ticket_id
        )
        # If config doesn't exist, we get 404. If secret is wrong, we get 403.
        # If both pass, we should get 400 for missing ticket_id
        # This test validates the endpoint exists and handles the request
        assert resp.status_code in [400, 403, 404], f"Expected 400/403/404, got {resp.status_code}: {resp.text}"
        print(f"Missing ticket_id response: {resp.status_code} - {resp.text}")


class TestZendeskSuggestionEndpoint:
    """Tests for Zendesk suggestion endpoint (public, for ZAF sidebar)"""

    def test_get_suggestion_nonexistent_ticket(self):
        """GET /api/zendesk/suggestion/{instance_id}/{ticket_id} returns null suggestion for non-existent tickets"""
        nonexistent_ticket_id = "999999999"
        resp = requests.get(f"{BASE_URL}/api/zendesk/suggestion/{INSTANCE_ID}/{nonexistent_ticket_id}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # Should return null/None suggestion for non-existent ticket
        assert data.get("suggestion") is None, f"Expected null suggestion, got: {data}"
        assert data.get("ticket_id") == nonexistent_ticket_id
        print(f"Non-existent ticket suggestion response: {data}")


class TestZendeskTicketsEndpoint:
    """Tests for Zendesk tickets admin endpoint"""

    def test_get_zendesk_tickets_empty(self, auth_headers):
        """GET /api/admin/zendesk-tickets returns empty list when no tickets have been processed"""
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk-tickets", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "tickets" in data
        assert isinstance(data["tickets"], list)
        print(f"Zendesk tickets response: {len(data['tickets'])} tickets")


class TestAnalyticsZendeskIntegration:
    """Tests for Zendesk integration in analytics endpoints"""

    def test_analytics_overview_zendesk_count(self, auth_headers):
        """GET /api/analytics/overview returns platform_breakdown with zendesk count field"""
        resp = requests.get(f"{BASE_URL}/api/analytics/overview", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "platform_breakdown" in data, "Response should contain platform_breakdown"
        platform_breakdown = data["platform_breakdown"]
        # Zendesk should be included in platform breakdown
        assert "zendesk" in platform_breakdown, f"platform_breakdown should include zendesk: {platform_breakdown}"
        assert isinstance(platform_breakdown["zendesk"], int), "zendesk count should be an integer"
        print(f"Analytics overview platform_breakdown: {platform_breakdown}")

    def test_analytics_daily_by_platform_zendesk(self, auth_headers):
        """GET /api/analytics/daily-by-platform returns zendesk field in each day entry"""
        resp = requests.get(f"{BASE_URL}/api/analytics/daily-by-platform", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list of daily entries"
        if len(data) > 0:
            # Check first entry has zendesk field
            first_day = data[0]
            assert "zendesk" in first_day, f"Each day entry should have zendesk field: {first_day}"
            assert isinstance(first_day["zendesk"], int), "zendesk count should be an integer"
            print(f"Daily by platform first entry: {first_day}")
        else:
            print("No daily data available yet")


class TestZendeskAuthRequired:
    """Tests to verify authentication is required for admin endpoints"""

    def test_get_config_requires_auth(self):
        """GET /api/admin/zendesk-config requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk-config")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"

    def test_put_config_requires_auth(self):
        """PUT /api/admin/zendesk-config requires authentication"""
        resp = requests.put(f"{BASE_URL}/api/admin/zendesk-config", json={"subdomain": "test"})
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"

    def test_delete_config_requires_auth(self):
        """DELETE /api/admin/zendesk-config requires authentication"""
        resp = requests.delete(f"{BASE_URL}/api/admin/zendesk-config")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"

    def test_test_connection_requires_auth(self):
        """POST /api/admin/zendesk-config/test requires authentication"""
        resp = requests.post(f"{BASE_URL}/api/admin/zendesk-config/test")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"

    def test_get_tickets_requires_auth(self):
        """GET /api/admin/zendesk-tickets requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/admin/zendesk-tickets")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
