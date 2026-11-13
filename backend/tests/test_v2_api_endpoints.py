"""
Test v2 API endpoints for BitBot Pro multi-bot architecture.
Tests Organisation → Bot → Connected Account → Connection data model.
All endpoints under /api/v2/.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"

# Migration data from review request
ORG_ID = "cb91e73c-b74b-45a3-aecc-f7823ee07d2c"
BOT_ID = "f014cae7-788f-447c-b524-7d72709daa80"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def org_headers(auth_token):
    """Headers with auth token and X-Org-ID."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
        "X-Org-ID": ORG_ID
    }


@pytest.fixture(scope="module")
def created_resources():
    """Track test-created resources for cleanup."""
    return {"orgs": [], "bots": [], "accounts": [], "connections": []}


# ============== AUTH GUARD TESTS ==============

class TestAuthGuards:
    """Test authentication and authorization guards."""
    
    def test_no_auth_returns_401(self):
        """Requests without Authorization header return 401."""
        response = requests.get(f"{BASE_URL}/api/v2/orgs")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: No auth returns 401")
    
    def test_wrong_org_id_returns_404(self, auth_headers):
        """Requests with wrong X-Org-ID return 404."""
        headers = {**auth_headers, "X-Org-ID": "non-existent-org-id"}
        response = requests.get(f"{BASE_URL}/api/v2/orgs/non-existent-org-id", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("PASS: Wrong org ID returns 404")
    
    def test_bot_not_in_org_returns_404(self, org_headers):
        """Requests to a bot not in the org return 404."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/non-existent-bot-id",
            headers=org_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("PASS: Bot not in org returns 404")


# ============== ORGANISATION TESTS ==============

class TestOrganisations:
    """Test Organisation CRUD endpoints."""
    
    def test_list_orgs(self, auth_headers):
        """GET /api/v2/orgs returns list of organisations."""
        response = requests.get(f"{BASE_URL}/api/v2/orgs", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "organisations" in data, "Response should contain 'organisations' key"
        orgs = data["organisations"]
        assert isinstance(orgs, list), "organisations should be a list"
        
        # Check that each org has required fields
        if orgs:
            org = orgs[0]
            assert "id" in org, "Org should have 'id'"
            assert "name" in org, "Org should have 'name'"
            assert "bot_count" in org, "Org should have 'bot_count'"
            assert "member_count" in org, "Org should have 'member_count'"
            assert "account_count" in org, "Org should have 'account_count'"
            print(f"PASS: List orgs returns {len(orgs)} organisations with required fields")
        else:
            print("PASS: List orgs returns empty list (no orgs)")
    
    def test_create_org(self, auth_headers, created_resources):
        """POST /api/v2/orgs creates a new organisation."""
        response = requests.post(
            f"{BASE_URL}/api/v2/orgs",
            headers=auth_headers,
            json={"name": "TEST_Org_v2_API", "description": "Test org for v2 API testing"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert data["name"] == "TEST_Org_v2_API", "Name should match"
        created_resources["orgs"].append(data["id"])
        print(f"PASS: Created org with id={data['id']}")
    
    def test_get_org_detail(self, org_headers):
        """GET /api/v2/orgs/{org_id} returns org detail."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}",
            headers=org_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["id"] == ORG_ID, "Org ID should match"
        assert "name" in data, "Should have name"
        assert "bot_count" in data, "Should have bot_count"
        assert "member_count" in data, "Should have member_count"
        assert "account_count" in data, "Should have account_count"
        print(f"PASS: Get org detail - name={data['name']}, bots={data['bot_count']}, members={data['member_count']}, accounts={data['account_count']}")
    
    def test_list_org_members(self, org_headers):
        """GET /api/v2/orgs/{org_id}/members lists org members."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/members",
            headers=org_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "members" in data, "Response should contain 'members'"
        members = data["members"]
        assert isinstance(members, list), "members should be a list"
        
        # Check member fields
        if members:
            member = members[0]
            assert "org_role" in member, "Member should have 'org_role'"
            assert "is_owner" in member, "Member should have 'is_owner'"
            print(f"PASS: List members returns {len(members)} members with org_role and is_owner fields")
        else:
            print("PASS: List members returns empty list")


# ============== BOT TESTS ==============

class TestBots:
    """Test Bot CRUD endpoints."""
    
    def test_list_bots(self, org_headers):
        """GET /api/v2/orgs/{org_id}/bots lists all bots in the org."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots",
            headers=org_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "bots" in data, "Response should contain 'bots'"
        bots = data["bots"]
        assert isinstance(bots, list), "bots should be a list"
        
        # Check bot fields
        if bots:
            bot = bots[0]
            assert "connection_count" in bot, "Bot should have 'connection_count'"
            assert "active_connection_count" in bot, "Bot should have 'active_connection_count'"
            print(f"PASS: List bots returns {len(bots)} bots with connection_count and active_connection_count")
        else:
            print("PASS: List bots returns empty list")
    
    def test_create_bot(self, org_headers, created_resources):
        """POST /api/v2/orgs/{org_id}/bots creates a new bot."""
        response = requests.post(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots",
            headers=org_headers,
            json={
                "name": "TEST_Bot_v2_API",
                "description": "Test bot for v2 API testing",
                "persona": "You are a helpful test bot."
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert data["name"] == "TEST_Bot_v2_API", "Name should match"
        assert "connection_count" in data, "Should have connection_count"
        assert "active_connection_count" in data, "Should have active_connection_count"
        created_resources["bots"].append(data["id"])
        print(f"PASS: Created bot with id={data['id']}")
        return data["id"]
    
    def test_get_bot_detail(self, org_headers):
        """GET /api/v2/orgs/{org_id}/bots/{bot_id} returns bot detail."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}",
            headers=org_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["id"] == BOT_ID, "Bot ID should match"
        assert "knowledge_source_count" in data, "Should have knowledge_source_count"
        assert "connection_count" in data, "Should have connection_count"
        assert "active_connection_count" in data, "Should have active_connection_count"
        print(f"PASS: Get bot detail - name={data.get('name')}, knowledge_sources={data['knowledge_source_count']}")
    
    def test_update_bot(self, org_headers, created_resources):
        """PUT /api/v2/orgs/{org_id}/bots/{bot_id} updates bot name and persona."""
        # First create a bot to update
        create_resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots",
            headers=org_headers,
            json={"name": "TEST_Bot_Update", "persona": "Original persona"}
        )
        assert create_resp.status_code == 200, f"Failed to create bot: {create_resp.text}"
        bot_id = create_resp.json()["id"]
        created_resources["bots"].append(bot_id)
        
        # Update the bot
        response = requests.put(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{bot_id}",
            headers=org_headers,
            json={"name": "TEST_Bot_Updated", "persona": "Updated persona"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("ok") == True, "Should return ok: true"
        
        # Verify update
        get_resp = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{bot_id}",
            headers=org_headers
        )
        assert get_resp.status_code == 200
        updated_bot = get_resp.json()
        assert updated_bot["name"] == "TEST_Bot_Updated", "Name should be updated"
        assert updated_bot["persona"] == "Updated persona", "Persona should be updated"
        print(f"PASS: Updated bot name and persona")
    
    def test_get_bot_settings(self, org_headers):
        """GET /api/v2/orgs/{org_id}/bots/{bot_id}/settings returns full behaviour settings."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/settings",
            headers=org_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check expected settings fields
        expected_fields = ["id", "name", "persona", "custom_instructions", "tone_instructions",
                          "knowledge_gate", "knowledge_gate_pct", "fallback_message", "llm_config"]
        for field in expected_fields:
            assert field in data, f"Settings should have '{field}'"
        print(f"PASS: Get bot settings returns all expected fields")


# ============== CONNECTED ACCOUNT TESTS ==============

class TestConnectedAccounts:
    """Test Connected Account CRUD endpoints."""
    
    def test_list_accounts(self, org_headers):
        """GET /api/v2/orgs/{org_id}/accounts lists connected accounts with masked credentials."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/accounts",
            headers=org_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "accounts" in data, "Response should contain 'accounts'"
        accounts = data["accounts"]
        assert isinstance(accounts, list), "accounts should be a list"
        
        # Check account fields
        if accounts:
            account = accounts[0]
            assert "credentials_masked" in account, "Account should have 'credentials_masked'"
            assert "connection_count" in account, "Account should have 'connection_count'"
            assert "active_connection_count" in account, "Account should have 'active_connection_count'"
            
            # Verify credentials are masked (should NOT contain raw tokens)
            creds_masked = account.get("credentials_masked", {})
            for key, value in creds_masked.items():
                if "token" in key.lower() or "secret" in key.lower() or "key" in key.lower():
                    # Should be masked (contain dots or be short)
                    if isinstance(value, str) and len(value) > 10:
                        assert "•" in value or len(value) <= 12, f"Credential '{key}' should be masked"
            print(f"PASS: List accounts returns {len(accounts)} accounts with masked credentials")
        else:
            print("PASS: List accounts returns empty list")
    
    def test_create_account(self, org_headers, created_resources):
        """POST /api/v2/orgs/{org_id}/accounts creates a new connected account."""
        response = requests.post(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/accounts",
            headers=org_headers,
            json={
                "provider": "discord",
                "name": "TEST_Discord_Account",
                "credentials": {"bot_token": "test_token_12345678901234567890"}
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert data["name"] == "TEST_Discord_Account", "Name should match"
        assert "credentials_masked" in data, "Should have credentials_masked"
        assert "connection_count" in data, "Should have connection_count"
        assert "active_connection_count" in data, "Should have active_connection_count"
        
        # Verify token is masked
        creds_masked = data.get("credentials_masked", {})
        if "bot_token" in creds_masked:
            assert "•" in creds_masked["bot_token"], "bot_token should be masked"
        
        created_resources["accounts"].append(data["id"])
        print(f"PASS: Created account with id={data['id']}, credentials masked")
        return data["id"]
    
    def test_get_account_detail(self, org_headers, created_resources):
        """GET /api/v2/orgs/{org_id}/accounts/{account_id} returns account detail."""
        # First create an account
        create_resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/accounts",
            headers=org_headers,
            json={
                "provider": "telegram",
                "name": "TEST_Telegram_Account",
                "credentials": {"bot_token": "test_telegram_token_1234567890"}
            }
        )
        assert create_resp.status_code == 200, f"Failed to create account: {create_resp.text}"
        account_id = create_resp.json()["id"]
        created_resources["accounts"].append(account_id)
        
        # Get account detail
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/accounts/{account_id}",
            headers=org_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["id"] == account_id, "Account ID should match"
        assert "credentials_masked" in data, "Should have credentials_masked"
        assert "connections" in data, "Should have list of connections using the account"
        print(f"PASS: Get account detail with masked credentials and connections list")


# ============== CONNECTION TESTS ==============

class TestConnections:
    """Test Connection CRUD endpoints."""
    
    @pytest.fixture(scope="class")
    def test_account_id(self, org_headers, created_resources):
        """Create a test account for connection tests."""
        response = requests.post(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/accounts",
            headers=org_headers,
            json={
                "provider": "discord",
                "name": "TEST_Connection_Account",
                "credentials": {"bot_token": "test_connection_token_1234567890"}
            }
        )
        if response.status_code != 200:
            pytest.skip(f"Failed to create test account: {response.text}")
        account_id = response.json()["id"]
        created_resources["accounts"].append(account_id)
        return account_id
    
    def test_list_connections(self, org_headers):
        """GET /api/v2/orgs/{org_id}/bots/{bot_id}/connections lists connections."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections",
            headers=org_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "connections" in data, "Response should contain 'connections'"
        connections = data["connections"]
        assert isinstance(connections, list), "connections should be a list"
        
        # Check connection fields
        if connections:
            conn = connections[0]
            assert "account_name" in conn, "Connection should have 'account_name'"
            assert "account_provider" in conn, "Connection should have 'account_provider'"
            assert "account_status" in conn, "Connection should have 'account_status'"
            assert "effective_settings" in conn, "Connection should have 'effective_settings'"
            print(f"PASS: List connections returns {len(connections)} connections with enriched fields")
        else:
            print("PASS: List connections returns empty list")
    
    def test_create_connection(self, org_headers, test_account_id, created_resources):
        """POST /api/v2/orgs/{org_id}/bots/{bot_id}/connections creates a new connection."""
        response = requests.post(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections",
            headers=org_headers,
            json={
                "account_id": test_account_id,
                "name": "TEST_Connection_v2",
                "destination": {"channel_id": "test_channel_123", "channel_name": "test-channel"},
                "response_mode": "agent_assist"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert data["name"] == "TEST_Connection_v2", "Name should match"
        assert "account_name" in data, "Should have account_name"
        assert "account_provider" in data, "Should have account_provider"
        assert "account_status" in data, "Should have account_status"
        assert "effective_settings" in data, "Should have effective_settings"
        created_resources["connections"].append(data["id"])
        print(f"PASS: Created connection with id={data['id']}")
        return data["id"]
    
    def test_toggle_connection(self, org_headers, test_account_id, created_resources):
        """PATCH /api/v2/orgs/{org_id}/bots/{bot_id}/connections/{conn_id}/toggle toggles enabled state."""
        # First create a connection
        create_resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections",
            headers=org_headers,
            json={
                "account_id": test_account_id,
                "name": "TEST_Toggle_Connection",
                "destination": {"channel_id": "toggle_channel_456", "channel_name": "toggle-channel"},
                "enabled": True
            }
        )
        assert create_resp.status_code == 200, f"Failed to create connection: {create_resp.text}"
        conn_id = create_resp.json()["id"]
        created_resources["connections"].append(conn_id)
        initial_enabled = create_resp.json().get("enabled", True)
        
        # Toggle the connection
        response = requests.patch(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections/{conn_id}/toggle",
            headers=org_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("ok") == True, "Should return ok: true"
        assert "enabled" in data, "Should return new enabled state"
        assert data["enabled"] != initial_enabled, "Enabled state should be toggled"
        print(f"PASS: Toggled connection enabled state from {initial_enabled} to {data['enabled']}")
    
    def test_overlapping_connection_returns_409(self, org_headers, test_account_id, created_resources):
        """POST with overlapping destination and account should return 409 conflict."""
        # Create first connection
        create_resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections",
            headers=org_headers,
            json={
                "account_id": test_account_id,
                "name": "TEST_Overlap_First",
                "destination": {"channel_id": "overlap_channel_789", "channel_name": "overlap-channel"},
                "enabled": True
            }
        )
        assert create_resp.status_code == 200, f"Failed to create first connection: {create_resp.text}"
        conn_id = create_resp.json()["id"]
        created_resources["connections"].append(conn_id)
        
        # Try to create overlapping connection (same account + same destination)
        response = requests.post(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections",
            headers=org_headers,
            json={
                "account_id": test_account_id,
                "name": "TEST_Overlap_Second",
                "destination": {"channel_id": "overlap_channel_789", "channel_name": "overlap-channel"},
                "enabled": True
            }
        )
        assert response.status_code == 409, f"Expected 409 conflict, got {response.status_code}: {response.text}"
        print("PASS: Overlapping connection returns 409 conflict")


# ============== BACKWARD COMPATIBILITY TESTS ==============

class TestBackwardCompatibility:
    """Test that v1 endpoints still work."""
    
    def test_v1_admin_instances_still_works(self, auth_headers):
        """GET /api/admin/instances still works with v1 auth."""
        response = requests.get(
            f"{BASE_URL}/api/admin/instances",
            headers=auth_headers
        )
        # Should return 200 (or 403 if not admin, but not 404)
        assert response.status_code in [200, 403], f"Expected 200 or 403, got {response.status_code}: {response.text}"
        print(f"PASS: v1 /api/admin/instances returns {response.status_code}")
    
    def test_v1_admin_bot_config_still_works(self, auth_headers):
        """GET /api/admin/bot-config still returns config for legacy instance_id."""
        # Use the legacy instance ID from test_credentials.md
        legacy_instance_id = "88bfae82-2533-4235-968d-b3298fd57073"
        headers = {**auth_headers, "X-Instance-ID": legacy_instance_id}
        response = requests.get(
            f"{BASE_URL}/api/admin/bot-config",
            headers=headers
        )
        # Should return 200 or 404 (if instance doesn't exist), but not 500
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
        print(f"PASS: v1 /api/admin/bot-config returns {response.status_code}")


# ============== CLEANUP ==============

@pytest.fixture(scope="module", autouse=True)
def cleanup(auth_token, created_resources):
    """Cleanup test-created resources after all tests."""
    yield
    
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
        "X-Org-ID": ORG_ID
    }
    
    # Delete connections first
    for conn_id in created_resources.get("connections", []):
        try:
            # Need to find which bot the connection belongs to
            # For simplicity, try with the known BOT_ID
            requests.delete(
                f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections/{conn_id}",
                headers=headers
            )
        except Exception:
            pass
    
    # Delete accounts
    for account_id in created_resources.get("accounts", []):
        try:
            requests.delete(
                f"{BASE_URL}/api/v2/orgs/{ORG_ID}/accounts/{account_id}",
                headers=headers
            )
        except Exception:
            pass
    
    # Delete bots
    for bot_id in created_resources.get("bots", []):
        try:
            # First disable all connections
            requests.delete(
                f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{bot_id}",
                headers=headers
            )
        except Exception:
            pass
    
    # Delete orgs (need different headers without X-Org-ID for each)
    for org_id in created_resources.get("orgs", []):
        try:
            org_headers = {
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json",
                "X-Org-ID": org_id
            }
            requests.delete(
                f"{BASE_URL}/api/v2/orgs/{org_id}",
                headers=org_headers
            )
        except Exception:
            pass
    
    print(f"Cleanup: Attempted to delete {len(created_resources.get('connections', []))} connections, "
          f"{len(created_resources.get('accounts', []))} accounts, "
          f"{len(created_resources.get('bots', []))} bots, "
          f"{len(created_resources.get('orgs', []))} orgs")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
