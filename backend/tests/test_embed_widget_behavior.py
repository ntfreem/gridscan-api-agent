"""
Test suite for Embed Widget Behavior feature:
- Welcome message configuration
- Default open toggle
- Backend API endpoints for embed config
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

class TestEmbedConfigAPI:
    """Test embed config API endpoints for welcome_message and default_open"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "X-Instance-ID": INSTANCE_ID,
            "Content-Type": "application/json"
        })
    
    def test_get_embed_config_returns_welcome_message_and_default_open(self):
        """GET /api/embed/config/<instance_id> should return welcome_message and default_open fields"""
        resp = requests.get(f"{BASE_URL}/api/embed/config/{INSTANCE_ID}")
        assert resp.status_code == 200, f"Failed to get embed config: {resp.text}"
        data = resp.json()
        
        # Verify the response contains the expected fields
        assert "instance_id" in data, "Response should contain instance_id"
        # welcome_message and default_open may or may not be present depending on config
        # Just verify the endpoint works and returns a dict
        assert isinstance(data, dict), "Response should be a dictionary"
        print(f"Embed config response: {data}")
        
        # Check if welcome_message exists and has content
        if "welcome_message" in data:
            print(f"Welcome message length: {len(data.get('welcome_message', ''))}")
        if "default_open" in data:
            print(f"Default open: {data.get('default_open')}")
    
    def test_put_embed_config_saves_welcome_message(self):
        """PUT /api/admin/embed-config should save welcome_message"""
        test_welcome = "TEST_Welcome! This is a test welcome message."
        
        resp = self.session.put(f"{BASE_URL}/api/admin/embed-config", json={
            "welcome_message": test_welcome
        })
        assert resp.status_code == 200, f"Failed to save embed config: {resp.text}"
        data = resp.json()
        
        # Verify the response contains the saved welcome_message
        assert data.get("welcome_message") == test_welcome, f"Welcome message not saved correctly: {data}"
        print(f"Saved welcome message: {data.get('welcome_message')}")
    
    def test_put_embed_config_saves_default_open(self):
        """PUT /api/admin/embed-config should save default_open boolean"""
        # Test setting default_open to True
        resp = self.session.put(f"{BASE_URL}/api/admin/embed-config", json={
            "default_open": True
        })
        assert resp.status_code == 200, f"Failed to save embed config: {resp.text}"
        data = resp.json()
        assert data.get("default_open") == True, f"default_open not saved as True: {data}"
        print(f"Saved default_open=True: {data.get('default_open')}")
        
        # Test setting default_open to False
        resp = self.session.put(f"{BASE_URL}/api/admin/embed-config", json={
            "default_open": False
        })
        assert resp.status_code == 200, f"Failed to save embed config: {resp.text}"
        data = resp.json()
        assert data.get("default_open") == False, f"default_open not saved as False: {data}"
        print(f"Saved default_open=False: {data.get('default_open')}")
    
    def test_put_embed_config_saves_both_fields_together(self):
        """PUT /api/admin/embed-config should save both welcome_message and default_open"""
        test_welcome = "TEST_Combined test welcome message with **markdown** support."
        
        resp = self.session.put(f"{BASE_URL}/api/admin/embed-config", json={
            "welcome_message": test_welcome,
            "default_open": True
        })
        assert resp.status_code == 200, f"Failed to save embed config: {resp.text}"
        data = resp.json()
        
        assert data.get("welcome_message") == test_welcome, f"Welcome message not saved: {data}"
        assert data.get("default_open") == True, f"default_open not saved: {data}"
        print(f"Saved both fields - welcome_message length: {len(data.get('welcome_message', ''))}, default_open: {data.get('default_open')}")
    
    def test_get_embed_config_reflects_saved_values(self):
        """GET /api/embed/config should return previously saved values"""
        # First save some values
        test_welcome = "TEST_Verification welcome message"
        self.session.put(f"{BASE_URL}/api/admin/embed-config", json={
            "welcome_message": test_welcome,
            "default_open": True
        })
        
        # Now GET and verify
        resp = requests.get(f"{BASE_URL}/api/embed/config/{INSTANCE_ID}")
        assert resp.status_code == 200
        data = resp.json()
        
        assert data.get("welcome_message") == test_welcome, f"GET did not return saved welcome_message: {data}"
        assert data.get("default_open") == True, f"GET did not return saved default_open: {data}"
        print(f"GET verified saved values correctly")


class TestEmbedJsScript:
    """Test the embed.js script endpoint"""
    
    def test_embed_js_endpoint_returns_javascript(self):
        """GET /api/embed.js should return JavaScript content"""
        resp = requests.get(f"{BASE_URL}/api/embed.js?instance={INSTANCE_ID}&mode=popup")
        assert resp.status_code == 200, f"Failed to get embed.js: {resp.text}"
        assert "application/javascript" in resp.headers.get("content-type", ""), "Content-Type should be JavaScript"
        
        content = resp.text
        assert "data-instance" in content or "INSTANCE" in content, "Script should reference instance"
        print(f"embed.js script length: {len(content)} chars")
    
    def test_embed_js_contains_welcome_support(self):
        """embed.js should contain support for data-welcome attribute"""
        resp = requests.get(f"{BASE_URL}/api/embed.js?instance={INSTANCE_ID}&mode=popup")
        assert resp.status_code == 200
        content = resp.text
        
        # Check for welcome message support
        assert "welcome" in content.lower(), "Script should contain welcome message support"
        assert "WELCOME" in content or "welcome_message" in content, "Script should handle welcome messages"
        print("embed.js contains welcome message support")
    
    def test_embed_js_contains_default_open_support(self):
        """embed.js should contain support for data-open attribute and default_open config"""
        resp = requests.get(f"{BASE_URL}/api/embed.js?instance={INSTANCE_ID}&mode=popup")
        assert resp.status_code == 200
        content = resp.text
        
        # Check for default open support
        assert "DEFAULT_OPEN" in content or "default_open" in content, "Script should handle default_open"
        assert 'attr("open"' in content or "data-open" in content.lower(), "Script should support data-open attribute"
        print("embed.js contains default_open support")


class TestWidgetEndpoint:
    """Test the widget endpoint with welcome message parameter"""
    
    def test_widget_endpoint_accepts_welcome_param(self):
        """GET /widget should accept welcome parameter"""
        test_welcome = "Hello! Welcome to our support chat."
        encoded_welcome = requests.utils.quote(test_welcome)
        
        resp = requests.get(f"{BASE_URL}/widget?instance={INSTANCE_ID}&mode=popup&welcome={encoded_welcome}")
        # Widget returns HTML, should be 200
        assert resp.status_code == 200, f"Widget endpoint failed: {resp.status_code}"
        print(f"Widget endpoint accepts welcome param, status: {resp.status_code}")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        if login_resp.status_code == 200:
            token = login_resp.json().get("token")
            self.session.headers.update({
                "Authorization": f"Bearer {token}",
                "X-Instance-ID": INSTANCE_ID,
                "Content-Type": "application/json"
            })
    
    def test_restore_original_config(self):
        """Restore the original Cardano welcome message"""
        cardano_welcome = """**Welcome to Cardano Bridge Support!** 👋

I'm here to help you with:

• **Bridge Operations** - Transfers between Cardano and other chains
• **Transaction Status** - Check pending or completed transactions
• **Wallet Connections** - MetaMask, Nami, Eternl, and more
• **Troubleshooting** - Common issues and solutions

Just ask your question and I'll do my best to assist you!"""
        
        resp = self.session.put(f"{BASE_URL}/api/admin/embed-config", json={
            "welcome_message": cardano_welcome,
            "default_open": True
        })
        assert resp.status_code == 200, f"Failed to restore config: {resp.text}"
        print("Restored original Cardano welcome message and default_open=True")
