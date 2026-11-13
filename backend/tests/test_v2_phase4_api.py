"""
Tests for V2 API Phase 4 — Provider Routing & Webhook Updates.

Tests:
1. V2 API endpoints (orgs, bots, accounts, connections)
2. Enhanced connection_activity endpoint (returns activity + suggestions)
3. Connection toggle (enable/disable)
4. Connection creation
5. Login and authentication
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ORG_ID = "cb91e73c-b74b-45a3-aecc-f7823ee07d2c"
BOT_ID = "f014cae7-788f-447c-b524-7d72709daa80"


class TestV2Authentication:
    """Test login and authentication for V2 API access."""
    
    def test_login_with_admin_credentials(self):
        """Login with administrator/Admin@123 should succeed."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("user", {}).get("role") in ["superadmin", "admin"], "User should be admin"
        print(f"✓ Login successful, role: {data.get('user', {}).get('role')}")


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for V2 API tests."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": "administrator",
        "password": "Admin@123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping V2 API tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token and org ID for V2 API requests."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Org-ID": ORG_ID,
        "Content-Type": "application/json"
    }


class TestV2OrgsEndpoint:
    """Test GET /api/v2/orgs endpoint."""
    
    def test_get_orgs_list(self, auth_headers):
        """GET /api/v2/orgs should return list of organizations."""
        response = requests.get(f"{BASE_URL}/api/v2/orgs", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Response is wrapped in {"organisations": [...]}
        assert "organisations" in data, "Response should have 'organisations' key"
        orgs = data["organisations"]
        assert isinstance(orgs, list), "organisations should be a list"
        assert len(orgs) > 0, "Should have at least one org"
        
        # Verify org structure
        org = orgs[0]
        assert "id" in org, "Org should have id"
        assert "name" in org, "Org should have name"
        print(f"✓ Found {len(orgs)} organization(s)")


class TestV2BotsEndpoint:
    """Test GET /api/v2/orgs/{org_id}/bots endpoint."""
    
    def test_get_bots_list(self, auth_headers):
        """GET /api/v2/orgs/{org_id}/bots should return list of bots."""
        response = requests.get(f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Response is wrapped in {"bots": [...]}
        assert "bots" in data, "Response should have 'bots' key"
        bots = data["bots"]
        assert isinstance(bots, list), "bots should be a list"
        assert len(bots) > 0, "Should have at least one bot"
        
        # Verify bot structure
        bot = bots[0]
        assert "id" in bot, "Bot should have id"
        assert "name" in bot, "Bot should have name"
        print(f"✓ Found {len(bots)} bot(s)")
    
    def test_get_specific_bot(self, auth_headers):
        """Verify API Tester bot exists."""
        response = requests.get(f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots", headers=auth_headers)
        assert response.status_code == 200
        bots = response.json().get("bots", [])
        
        api_tester = next((b for b in bots if b["id"] == BOT_ID), None)
        assert api_tester is not None, f"API Tester bot {BOT_ID} not found"
        print(f"✓ Found API Tester bot: {api_tester.get('name')}")


class TestV2AccountsEndpoint:
    """Test GET /api/v2/orgs/{org_id}/accounts endpoint."""
    
    def test_get_accounts_list(self, auth_headers):
        """GET /api/v2/orgs/{org_id}/accounts should return list of connected accounts."""
        response = requests.get(f"{BASE_URL}/api/v2/orgs/{ORG_ID}/accounts", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Response is wrapped in {"accounts": [...]}
        assert "accounts" in data, "Response should have 'accounts' key"
        accounts = data["accounts"]
        assert isinstance(accounts, list), "accounts should be a list"
        
        # Verify account structure if accounts exist
        if len(accounts) > 0:
            account = accounts[0]
            assert "id" in account, "Account should have id"
            assert "provider" in account, "Account should have provider"
            assert account["provider"] in ["discord", "telegram", "zendesk"], "Invalid provider"
        print(f"✓ Found {len(accounts)} connected account(s)")


class TestV2ConnectionsEndpoint:
    """Test GET /api/v2/orgs/{org_id}/bots/{bot_id}/connections endpoint."""
    
    def test_get_connections_list(self, auth_headers):
        """GET /api/v2/orgs/{org_id}/bots/{bot_id}/connections should return list of connections."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Response is wrapped in {"connections": [...], "bot_defaults": {...}}
        assert "connections" in data, "Response should have 'connections' key"
        connections = data["connections"]
        assert isinstance(connections, list), "connections should be a list"
        
        # Verify connection structure if connections exist
        if len(connections) > 0:
            conn = connections[0]
            assert "id" in conn, "Connection should have id"
            assert "bot_id" in conn, "Connection should have bot_id"
            assert "account_id" in conn, "Connection should have account_id"
            assert "response_mode" in conn, "Connection should have response_mode"
            assert conn["response_mode"] in ["auto_reply", "agent_assist", "internal_note", "sidebar_only"]
        print(f"✓ Found {len(connections)} connection(s) for bot {BOT_ID}")


class TestV2ConnectionActivity:
    """Test enhanced connection_activity endpoint returning activity + suggestions."""
    
    @pytest.fixture
    def connection_id(self, auth_headers):
        """Get a connection ID for testing."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections",
            headers=auth_headers
        )
        if response.status_code == 200:
            connections = response.json().get("connections", [])
            if connections:
                return connections[0]["id"]
        pytest.skip("No connections available for activity test")
    
    def test_connection_activity_returns_activity_and_suggestions(self, auth_headers, connection_id):
        """GET /api/v2/orgs/{org_id}/bots/{bot_id}/connections/{conn_id}/activity should return activity + suggestions."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections/{connection_id}/activity",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure includes both activity and suggestions
        assert "activity" in data, "Response should have 'activity' field"
        assert "suggestions" in data, "Response should have 'suggestions' field"
        assert "connection_id" in data, "Response should have 'connection_id' field"
        assert "response_mode" in data, "Response should have 'response_mode' field"
        
        # Verify types
        assert isinstance(data["activity"], list), "'activity' should be a list"
        assert isinstance(data["suggestions"], list), "'suggestions' should be a list"
        assert data["connection_id"] == connection_id, "connection_id should match"
        
        print(f"✓ Connection activity endpoint returns: activity={len(data['activity'])}, suggestions={len(data['suggestions'])}, mode={data['response_mode']}")
    
    def test_connection_activity_invalid_connection(self, auth_headers):
        """GET with invalid connection_id should return 404."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections/invalid-conn-id/activity",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid connection returns 404")


class TestV2ConnectionToggle:
    """Test connection toggle (enable/disable) endpoint."""
    
    @pytest.fixture
    def test_connection(self, auth_headers):
        """Get a connection for toggle testing."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections",
            headers=auth_headers
        )
        if response.status_code == 200:
            connections = response.json().get("connections", [])
            if connections:
                return connections[0]
        pytest.skip("No connections available for toggle test")
    
    def test_toggle_connection_disable_enable(self, auth_headers, test_connection):
        """PATCH /api/v2/orgs/{org_id}/bots/{bot_id}/connections/{conn_id}/toggle should toggle enabled state."""
        conn_id = test_connection["id"]
        original_enabled = test_connection.get("enabled", True)
        
        # Toggle to opposite state
        response = requests.patch(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections/{conn_id}/toggle",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Toggle failed: {response.text}"
        data = response.json()
        assert "enabled" in data, "Response should have 'enabled' field"
        assert data["enabled"] != original_enabled, "Enabled state should have toggled"
        print(f"✓ Connection toggled from {original_enabled} to {data['enabled']}")
        
        # Toggle back to original state
        response = requests.patch(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections/{conn_id}/toggle",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] == original_enabled, "Should be back to original state"
        print(f"✓ Connection toggled back to {original_enabled}")


class TestV2ConnectionCreation:
    """Test connection creation endpoint."""
    
    @pytest.fixture
    def test_account_id(self, auth_headers):
        """Get an account ID for connection creation."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/accounts",
            headers=auth_headers
        )
        if response.status_code == 200:
            accounts = response.json().get("accounts", [])
            if accounts:
                return accounts[0]["id"]
        pytest.skip("No accounts available for connection creation test")
    
    def test_create_connection(self, auth_headers, test_account_id):
        """POST /api/v2/orgs/{org_id}/bots/{bot_id}/connections should create a new connection."""
        import uuid
        test_name = f"TEST_Connection_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "account_id": test_account_id,
            "name": test_name,
            "response_mode": "agent_assist",
            "enabled": False,  # Create disabled to avoid affecting live system
            "destination": {},
            "overrides": {},
            "override_flags": {}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections",
            headers=auth_headers,
            json=payload
        )
        
        # Connection creation should succeed
        assert response.status_code in [200, 201], f"Creation failed: {response.text}"
        data = response.json()
        assert "id" in data, "Response should have 'id' field"
        assert data["name"] == test_name, "Name should match"
        assert data["response_mode"] == "agent_assist", "Response mode should match"
        
        created_conn_id = data["id"]
        print(f"✓ Created connection: {created_conn_id}")
        
        # Cleanup: Delete the test connection
        delete_response = requests.delete(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections/{created_conn_id}",
            headers=auth_headers
        )
        if delete_response.status_code in [200, 204]:
            print(f"✓ Cleaned up test connection")
        else:
            print(f"⚠ Could not delete test connection: {delete_response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
