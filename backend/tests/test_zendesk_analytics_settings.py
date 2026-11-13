"""
Test Zendesk Analytics Dashboard and Settings UX improvements
- /api/analytics/zendesk endpoint
- /api/admin/zendesk/oauth/callback-url endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"


class TestZendeskAnalyticsEndpoint:
    """Tests for /api/analytics/zendesk endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication for tests"""
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "X-Instance-ID": INSTANCE_ID
        })
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def test_zendesk_analytics_returns_200(self):
        """Test that /api/analytics/zendesk returns 200 OK"""
        response = self.session.get(f"{BASE_URL}/api/analytics/zendesk")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ /api/analytics/zendesk returns 200 OK")
    
    def test_zendesk_analytics_has_required_fields(self):
        """Test that response contains all required fields"""
        response = self.session.get(f"{BASE_URL}/api/analytics/zendesk")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "total", "today", "last_7_days", "auto_replies", "agent_assists",
            "auto_reply_failed", "pending", "success_rate", "daily", "recent",
            "connected", "is_active", "auto_reply_enabled"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            print(f"✓ Field '{field}' present in response")
        
        print("✓ All required fields present in /api/analytics/zendesk response")
    
    def test_zendesk_analytics_field_types(self):
        """Test that fields have correct types"""
        response = self.session.get(f"{BASE_URL}/api/analytics/zendesk")
        assert response.status_code == 200
        data = response.json()
        
        # Integer fields
        int_fields = ["total", "today", "last_7_days", "auto_replies", "agent_assists", "auto_reply_failed", "pending"]
        for field in int_fields:
            assert isinstance(data[field], int), f"Field '{field}' should be int, got {type(data[field])}"
        
        # Float field
        assert isinstance(data["success_rate"], (int, float)), f"success_rate should be numeric"
        
        # Boolean fields
        bool_fields = ["connected", "is_active", "auto_reply_enabled"]
        for field in bool_fields:
            assert isinstance(data[field], bool), f"Field '{field}' should be bool, got {type(data[field])}"
        
        # Array fields
        assert isinstance(data["daily"], list), "daily should be a list"
        assert isinstance(data["recent"], list), "recent should be a list"
        
        print("✓ All field types are correct")
    
    def test_zendesk_analytics_daily_has_7_days(self):
        """Test that daily array contains 7 days of data"""
        response = self.session.get(f"{BASE_URL}/api/analytics/zendesk")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["daily"]) == 7, f"Expected 7 days, got {len(data['daily'])}"
        
        # Check each day has required fields
        for day in data["daily"]:
            assert "date" in day, "Each day should have 'date' field"
            assert "tickets" in day, "Each day should have 'tickets' field"
            assert "auto_replies" in day, "Each day should have 'auto_replies' field"
            assert "suggestions" in day, "Each day should have 'suggestions' field"
        
        print("✓ Daily array has 7 days with correct structure")
    
    def test_zendesk_analytics_success_rate_valid_range(self):
        """Test that success_rate is between 0 and 100"""
        response = self.session.get(f"{BASE_URL}/api/analytics/zendesk")
        assert response.status_code == 200
        data = response.json()
        
        assert 0 <= data["success_rate"] <= 100, f"success_rate should be 0-100, got {data['success_rate']}"
        print(f"✓ success_rate is valid: {data['success_rate']}%")
    
    def test_zendesk_analytics_requires_auth(self):
        """Test that endpoint requires authentication"""
        unauth_session = requests.Session()
        unauth_session.headers.update({
            "Content-Type": "application/json",
            "X-Instance-ID": INSTANCE_ID
        })
        response = unauth_session.get(f"{BASE_URL}/api/analytics/zendesk")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ /api/analytics/zendesk requires authentication")


class TestZendeskOAuthCallbackUrl:
    """Tests for /api/admin/zendesk/oauth/callback-url endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication for tests"""
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "X-Instance-ID": INSTANCE_ID
        })
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def test_callback_url_returns_200(self):
        """Test that /api/admin/zendesk/oauth/callback-url returns 200 OK"""
        response = self.session.get(f"{BASE_URL}/api/admin/zendesk/oauth/callback-url")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ /api/admin/zendesk/oauth/callback-url returns 200 OK")
    
    def test_callback_url_has_callback_url_field(self):
        """Test that response contains callback_url field"""
        response = self.session.get(f"{BASE_URL}/api/admin/zendesk/oauth/callback-url")
        assert response.status_code == 200
        data = response.json()
        
        assert "callback_url" in data, "Response should contain 'callback_url' field"
        print(f"✓ callback_url field present: {data['callback_url']}")
    
    def test_callback_url_format(self):
        """Test that callback_url ends with /api/zendesk/oauth/callback"""
        response = self.session.get(f"{BASE_URL}/api/admin/zendesk/oauth/callback-url")
        assert response.status_code == 200
        data = response.json()
        
        callback_url = data["callback_url"]
        assert callback_url.endswith("/api/zendesk/oauth/callback"), \
            f"callback_url should end with /api/zendesk/oauth/callback, got: {callback_url}"
        print(f"✓ callback_url has correct format: {callback_url}")
    
    def test_callback_url_is_https(self):
        """Test that callback_url uses HTTPS (for production)"""
        response = self.session.get(f"{BASE_URL}/api/admin/zendesk/oauth/callback-url")
        assert response.status_code == 200
        data = response.json()
        
        callback_url = data["callback_url"]
        # In production, should be HTTPS
        assert callback_url.startswith("https://"), \
            f"callback_url should start with https://, got: {callback_url}"
        print(f"✓ callback_url uses HTTPS: {callback_url}")
    
    def test_callback_url_requires_auth(self):
        """Test that endpoint requires authentication"""
        unauth_session = requests.Session()
        unauth_session.headers.update({
            "Content-Type": "application/json",
            "X-Instance-ID": INSTANCE_ID
        })
        response = unauth_session.get(f"{BASE_URL}/api/admin/zendesk/oauth/callback-url")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ /api/admin/zendesk/oauth/callback-url requires authentication")


class TestZendeskConfigEndpoint:
    """Tests for /api/admin/zendesk-config endpoint (existing, verify callback URL integration)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication for tests"""
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "X-Instance-ID": INSTANCE_ID
        })
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def test_zendesk_config_returns_200(self):
        """Test that /api/admin/zendesk-config returns 200 OK"""
        response = self.session.get(f"{BASE_URL}/api/admin/zendesk-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ /api/admin/zendesk-config returns 200 OK")
    
    def test_zendesk_config_has_oauth_configured_field(self):
        """Test that response contains oauth_configured field"""
        response = self.session.get(f"{BASE_URL}/api/admin/zendesk-config")
        assert response.status_code == 200
        data = response.json()
        
        assert "oauth_configured" in data, "Response should contain 'oauth_configured' field"
        assert isinstance(data["oauth_configured"], bool), "oauth_configured should be boolean"
        print(f"✓ oauth_configured field present: {data['oauth_configured']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
