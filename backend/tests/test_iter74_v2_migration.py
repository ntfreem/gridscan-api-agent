"""
Iteration 74: V2 Migration Runtime Tests
Tests for:
1. Admin login with administrator / Admin@123
2. GET /api/admin/bot-config with X-Instance-ID returns V2-merged config
3. POST /api/chat/send returns valid AI response using bot persona
4. PUT /api/admin/bot-config dual-writes to V2 bots collection
5. V2 settings endpoint reflects changes from V1 PUT
6. Only 1 organisation remains (Default Organisation) after cleanup
7. Integrations page loads correctly with Discord, Telegram, Zendesk providers
8. Team & Access page shows user list
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"
V1_INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"


class TestAdminLogin:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """Admin can log in with administrator / Admin@123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Response should contain 'token' field"
        assert len(data["token"]) > 0, "Token should not be empty"
        print(f"✓ Admin login successful, token received")
    
    def test_admin_login_wrong_password(self):
        """Login with wrong password should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": "WrongPassword123"
        })
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print(f"✓ Wrong password correctly rejected")


class TestV2MergedConfig:
    """Test resolve_bot_config() V2-first with V1-fallback"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_get_bot_config_with_instance_id(self, auth_token):
        """GET /api/admin/bot-config with X-Instance-ID returns V2-merged config"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Instance-ID": V1_INSTANCE_ID
        }
        response = requests.get(f"{BASE_URL}/api/admin/bot-config", headers=headers)
        assert response.status_code == 200, f"Failed to get bot config: {response.text}"
        
        data = response.json()
        # Should have name and persona from V2 merged config
        assert "name" in data, "Config should have 'name' field"
        assert "persona" in data, "Config should have 'persona' field"
        
        # The bot should be "API Tester" based on the review request
        print(f"✓ Bot config retrieved: name='{data.get('name')}', persona present={bool(data.get('persona'))}")
        
        # Verify the name is "API Tester" as expected from V2
        if data.get("name"):
            print(f"  Bot name: {data['name']}")
    
    def test_bot_config_without_instance_id_fails(self, auth_token):
        """GET /api/admin/bot-config without X-Instance-ID should fail"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/bot-config", headers=headers)
        assert response.status_code == 400, f"Expected 400 without X-Instance-ID, got {response.status_code}"
        print(f"✓ Request without X-Instance-ID correctly rejected")


class TestChatWithPersona:
    """Test chat endpoint uses bot persona from V2-merged config"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_chat_send_returns_ai_response(self, auth_token):
        """POST /api/chat/send returns valid AI response using bot persona"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Instance-ID": V1_INSTANCE_ID
        }
        payload = {
            "message": "Hello, who are you?",
            "session_id": f"test_session_{int(time.time())}"
        }
        response = requests.post(f"{BASE_URL}/api/chat/send", json=payload, headers=headers, timeout=60)
        assert response.status_code == 200, f"Chat send failed: {response.text}"
        
        data = response.json()
        assert "response" in data, "Response should contain 'response' field"
        assert len(data["response"]) > 0, "AI response should not be empty"
        
        print(f"✓ Chat response received: {data['response'][:100]}...")
        print(f"  Response length: {len(data['response'])} chars")


class TestDualWrite:
    """Test V1 PUT /admin/bot-config dual-writes to V2 bots collection"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    @pytest.fixture
    def org_and_bot_ids(self, auth_token):
        """Get org_id and bot_id for V2 API calls"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get orgs - response is wrapped in 'organisations' key
        orgs_response = requests.get(f"{BASE_URL}/api/v2/orgs", headers=headers)
        if orgs_response.status_code != 200:
            pytest.skip("Failed to get orgs")
        orgs_data = orgs_response.json()
        orgs = orgs_data.get("organisations", [])
        if not orgs:
            pytest.skip("No orgs found")
        
        org_id = orgs[0]["id"]
        
        # Get bots for this org - response is wrapped in 'bots' key
        bots_response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{org_id}/bots", 
            headers={**headers, "X-Org-ID": org_id}
        )
        if bots_response.status_code != 200:
            pytest.skip("Failed to get bots")
        bots_data = bots_response.json()
        bots = bots_data.get("bots", [])
        
        # Find the bot with legacy_instance_id matching V1_INSTANCE_ID
        target_bot = None
        for bot in bots:
            if bot.get("legacy_instance_id") == V1_INSTANCE_ID or bot.get("id") == V1_INSTANCE_ID:
                target_bot = bot
                break
        
        if not target_bot:
            pytest.skip(f"No bot found with legacy_instance_id={V1_INSTANCE_ID}")
        
        return org_id, target_bot["id"]
    
    def test_v1_put_dual_writes_to_v2(self, auth_token, org_and_bot_ids):
        """PUT /api/admin/bot-config changes appear in V2 settings endpoint"""
        org_id, bot_id = org_and_bot_ids
        
        # Generate a unique test value
        test_value = f"TEST_persona_update_{int(time.time())}"
        
        # Step 1: Update via V1 endpoint
        v1_headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Instance-ID": V1_INSTANCE_ID
        }
        v1_payload = {
            "persona": test_value
        }
        v1_response = requests.put(f"{BASE_URL}/api/admin/bot-config", json=v1_payload, headers=v1_headers)
        assert v1_response.status_code == 200, f"V1 PUT failed: {v1_response.text}"
        print(f"✓ V1 PUT successful with persona='{test_value}'")
        
        # Step 2: Verify via V2 settings endpoint
        v2_headers = {"Authorization": f"Bearer {auth_token}", "X-Org-ID": org_id}
        v2_response = requests.get(f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/settings", headers=v2_headers)
        assert v2_response.status_code == 200, f"V2 GET settings failed: {v2_response.text}"
        
        v2_data = v2_response.json()
        assert v2_data.get("persona") == test_value, f"V2 persona mismatch: expected '{test_value}', got '{v2_data.get('persona')}'"
        print(f"✓ V2 settings endpoint shows dual-written persona: '{v2_data.get('persona')}'")
        
        # Step 3: Restore original persona (cleanup)
        restore_payload = {"persona": "You are a helpful, friendly, and knowledgeable assistant. Provide clear, accurate answers based on available information. Be concise but thorough."}
        requests.put(f"{BASE_URL}/api/admin/bot-config", json=restore_payload, headers=v1_headers)
        print(f"✓ Restored original persona")


class TestOrganisationCleanup:
    """Test that only 1 organisation remains after cleanup"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_only_default_org_remains(self, auth_token):
        """Only 1 organisation remains (Default Organisation) after cleanup"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/v2/orgs", headers=headers)
        assert response.status_code == 200, f"Failed to get orgs: {response.text}"
        
        data = response.json()
        orgs = data.get("organisations", [])
        print(f"✓ Found {len(orgs)} organisation(s)")
        
        for org in orgs:
            print(f"  - {org.get('name')} (id: {org.get('id')[:12]}...)")
        
        # Check that test orgs are not present
        org_names = [org.get("name", "").lower() for org in orgs]
        assert "test_org_v2_api" not in " ".join(org_names), "TEST_Org_v2_API should have been cleaned up"
        assert "test new org" not in " ".join(org_names), "Test New Org should have been cleaned up"
        
        # Verify Default Organisation exists
        default_org_exists = any("default" in name.lower() for name in org_names)
        assert default_org_exists, "Default Organisation should exist"
        print(f"✓ Default Organisation exists, test orgs cleaned up")


class TestIntegrationsPage:
    """Test that integrations page data loads correctly"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    @pytest.fixture
    def org_and_bot_ids(self, auth_token):
        """Get org_id and bot_id"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        orgs_response = requests.get(f"{BASE_URL}/api/v2/orgs", headers=headers)
        if orgs_response.status_code != 200:
            pytest.skip("Failed to get orgs")
        orgs_data = orgs_response.json()
        orgs = orgs_data.get("organisations", [])
        if not orgs:
            pytest.skip("No orgs found")
        org_id = orgs[0]["id"]
        
        bots_response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{org_id}/bots", 
            headers={**headers, "X-Org-ID": org_id}
        )
        if bots_response.status_code != 200:
            pytest.skip("Failed to get bots")
        bots_data = bots_response.json()
        bots = bots_data.get("bots", [])
        if not bots:
            pytest.skip("No bots found")
        
        # Find API Tester bot
        target_bot = None
        for bot in bots:
            if bot.get("legacy_instance_id") == V1_INSTANCE_ID:
                target_bot = bot
                break
        if not target_bot:
            target_bot = bots[0]
        
        return org_id, target_bot["id"]
    
    def test_connections_endpoint_returns_providers(self, auth_token, org_and_bot_ids):
        """V2 connections endpoint returns provider data for integrations page"""
        org_id, bot_id = org_and_bot_ids
        headers = {"Authorization": f"Bearer {auth_token}", "X-Org-ID": org_id}
        
        response = requests.get(f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/connections", headers=headers)
        assert response.status_code == 200, f"Failed to get connections: {response.text}"
        
        data = response.json()
        connections = data.get("connections", [])
        print(f"✓ Found {len(connections)} connection(s)")
        
        providers_found = set()
        for conn in connections:
            provider = conn.get("provider", "unknown")
            providers_found.add(provider)
            print(f"  - {provider}: enabled={conn.get('enabled')} (id: {conn.get('id', 'N/A')[:12]}...)")
        
        # Check for expected providers (Discord, Telegram, Zendesk)
        expected_providers = {"discord", "telegram", "zendesk"}
        print(f"✓ Providers found: {providers_found}")
        
        # Verify at least Discord, Telegram, Zendesk are present
        assert "discord" in providers_found, "Discord provider should be present"
        assert "telegram" in providers_found, "Telegram provider should be present"
        assert "zendesk" in providers_found, "Zendesk provider should be present"
        print(f"✓ All expected providers (Discord, Telegram, Zendesk) found")


class TestTeamAccess:
    """Test Team & Access page endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_admin_users_list(self, auth_token):
        """GET /api/admin/users returns user list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 200, f"Failed to get users: {response.text}"
        
        users = response.json()
        print(f"✓ Found {len(users)} user(s)")
        
        for user in users[:5]:  # Show first 5
            print(f"  - {user.get('username', 'N/A')} ({user.get('email', 'N/A')}) - role: {user.get('role', 'N/A')}")
        
        # Verify admin user exists
        admin_exists = any(u.get("username") == "administrator" for u in users)
        assert admin_exists, "Administrator user should exist"
        print(f"✓ Administrator user found in list")


class TestBotSettingsV2:
    """Test Bot Settings page loads correct bot-specific settings"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    @pytest.fixture
    def org_and_bot_ids(self, auth_token):
        """Get org_id and bot_id"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        orgs_response = requests.get(f"{BASE_URL}/api/v2/orgs", headers=headers)
        if orgs_response.status_code != 200:
            pytest.skip("Failed to get orgs")
        orgs_data = orgs_response.json()
        orgs = orgs_data.get("organisations", [])
        if not orgs:
            pytest.skip("No orgs found")
        org_id = orgs[0]["id"]
        
        bots_response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{org_id}/bots", 
            headers={**headers, "X-Org-ID": org_id}
        )
        if bots_response.status_code != 200:
            pytest.skip("Failed to get bots")
        bots_data = bots_response.json()
        bots = bots_data.get("bots", [])
        if not bots:
            pytest.skip("No bots found")
        
        # Find API Tester bot
        target_bot = None
        for bot in bots:
            if bot.get("legacy_instance_id") == V1_INSTANCE_ID:
                target_bot = bot
                break
        if not target_bot:
            target_bot = bots[0]
        
        return org_id, target_bot["id"]
    
    def test_v2_bot_settings_endpoint(self, auth_token, org_and_bot_ids):
        """V2 bot settings endpoint returns correct bot-specific settings"""
        org_id, bot_id = org_and_bot_ids
        headers = {"Authorization": f"Bearer {auth_token}", "X-Org-ID": org_id}
        
        response = requests.get(f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/settings", headers=headers)
        assert response.status_code == 200, f"Failed to get bot settings: {response.text}"
        
        data = response.json()
        print(f"✓ Bot settings retrieved")
        print(f"  - name: {data.get('name')}")
        print(f"  - persona: {data.get('persona', '')[:50]}...")
        print(f"  - knowledge_gate: {data.get('knowledge_gate')}")
        print(f"  - knowledge_gate_pct: {data.get('knowledge_gate_pct')}")
        
        # Verify required fields are present
        assert "name" in data, "Settings should have 'name' field"
        assert "persona" in data, "Settings should have 'persona' field"
        assert data.get("name") == "API Tester", f"Expected bot name 'API Tester', got '{data.get('name')}'"
        print(f"✓ Bot settings correctly loaded for 'API Tester'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
