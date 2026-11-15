"""
Iteration 77: V1 Cleanup Testing
Tests for V1 endpoint removal and V2 API migration.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    data = resp.json()
    assert "token" in data, "No token in login response"
    return data["token"]


@pytest.fixture(scope="module")
def org_and_bot(auth_token):
    """Get org ID and bot ID for V2 API testing."""
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Get orgs (response uses "organisations" key)
    resp = requests.get(f"{BASE_URL}/api/v2/orgs", headers=headers)
    assert resp.status_code == 200, f"Failed to get orgs: {resp.text}"
    orgs = resp.json().get("organisations", [])
    assert len(orgs) > 0, "No orgs found"
    org_id = orgs[0]["id"]
    
    # Get bots
    headers["X-Org-ID"] = org_id
    resp = requests.get(f"{BASE_URL}/api/v2/orgs/{org_id}/bots", headers=headers)
    assert resp.status_code == 200, f"Failed to get bots: {resp.text}"
    bots = resp.json().get("bots", [])
    assert len(bots) > 0, "No bots found"
    bot_id = bots[0]["id"]
    
    return {"org_id": org_id, "bot_id": bot_id}


class TestLoginAndAuth:
    """Test admin login functionality."""
    
    def test_admin_login_success(self):
        """Admin can log in with administrator/Admin@123."""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "superadmin"
        # V2 migration: instances now come from V2 bots collection
        assert "instances" in data
        print(f"✓ Login successful, got {len(data.get('instances', []))} instances")


class TestV1EndpointsRemoved:
    """Verify V1 endpoints return 404 (removed)."""
    
    def test_admin_instances_returns_404(self, auth_token):
        """GET /api/admin/instances should return 404."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/admin/instances", headers=headers)
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("✓ GET /api/admin/instances returns 404 (removed)")
    
    def test_admin_bot_config_returns_404(self, auth_token):
        """GET /api/admin/bot-config should return 404."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.get(f"{BASE_URL}/api/admin/bot-config", headers=headers)
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("✓ GET /api/admin/bot-config returns 404 (removed)")
    
    def test_v1_chat_returns_404(self, auth_token):
        """POST /api/v1/chat should return 404."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.post(f"{BASE_URL}/api/v1/chat", headers=headers, json={
            "message": "test"
        })
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("✓ POST /api/v1/chat returns 404 (removed)")
    
    def test_v1_chat_stream_returns_404(self, auth_token):
        """POST /api/v1/chat/stream should return 404."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        resp = requests.post(f"{BASE_URL}/api/v1/chat/stream", headers=headers, json={
            "message": "test"
        })
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("✓ POST /api/v1/chat/stream returns 404 (removed)")


class TestPublicBotInfoEndpoint:
    """Test the new public /bot-info/{bot_id} endpoint."""
    
    def test_bot_info_returns_name_and_persona(self, org_and_bot):
        """GET /api/bot-info/{bot_id} returns bot name and persona without auth."""
        bot_id = org_and_bot["bot_id"]
        # No auth header - this is a public endpoint
        resp = requests.get(f"{BASE_URL}/api/bot-info/{bot_id}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "name" in data, "Response missing 'name'"
        assert "persona" in data, "Response missing 'persona'"
        print(f"✓ GET /api/bot-info/{bot_id} returns name='{data['name']}' (public, no auth)")
    
    def test_bot_info_default_fallback(self):
        """GET /api/bot-info/default returns default assistant info."""
        resp = requests.get(f"{BASE_URL}/api/bot-info/default")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "name" in data
        print(f"✓ GET /api/bot-info/default returns name='{data['name']}'")


class TestV2LlmConfigEndpoints:
    """Test V2 LLM config endpoints."""
    
    def test_get_llm_config(self, auth_token, org_and_bot):
        """GET /api/v2/orgs/{org_id}/bots/{bot_id}/llm-config returns config."""
        org_id = org_and_bot["org_id"]
        bot_id = org_and_bot["bot_id"]
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Org-ID": org_id
        }
        resp = requests.get(f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/llm-config", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "provider" in data, "Response missing 'provider'"
        assert "model" in data, "Response missing 'model'"
        assert "allowed_anthropic_models" in data, "Response missing 'allowed_anthropic_models'"
        assert "allowed_openai_models" in data, "Response missing 'allowed_openai_models'"
        print(f"✓ GET llm-config returns provider='{data['provider']}', model='{data['model']}'")
    
    def test_put_llm_config(self, auth_token, org_and_bot):
        """PUT /api/v2/orgs/{org_id}/bots/{bot_id}/llm-config saves config."""
        org_id = org_and_bot["org_id"]
        bot_id = org_and_bot["bot_id"]
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Org-ID": org_id
        }
        # Save with emergent provider (default)
        resp = requests.put(
            f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/llm-config",
            headers=headers,
            json={"provider": "emergent", "model": ""}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") == True, "Expected success=True"
        assert data.get("provider") == "emergent"
        print("✓ PUT llm-config saves provider successfully")
    
    def test_test_llm_config(self, auth_token, org_and_bot):
        """POST /api/v2/orgs/{org_id}/bots/{bot_id}/llm-config/test pings LLM."""
        org_id = org_and_bot["org_id"]
        bot_id = org_and_bot["bot_id"]
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Org-ID": org_id
        }
        resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/llm-config/test",
            headers=headers
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # Test may succeed or fail depending on LLM availability
        assert "success" in data, "Response missing 'success'"
        if data["success"]:
            print(f"✓ LLM test ping succeeded: {data.get('response', '')[:50]}")
        else:
            print(f"✓ LLM test endpoint works (test failed: {data.get('error', '')[:50]})")


class TestV2BotSettingsEndpoints:
    """Test V2 bot settings endpoints."""
    
    def test_get_bot_settings(self, auth_token, org_and_bot):
        """GET /api/v2/orgs/{org_id}/bots/{bot_id}/settings returns settings."""
        org_id = org_and_bot["org_id"]
        bot_id = org_and_bot["bot_id"]
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Org-ID": org_id
        }
        resp = requests.get(f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/settings", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert "name" in data
        assert "persona" in data
        assert "custom_instructions" in data
        assert "knowledge_gate" in data
        print(f"✓ GET bot settings returns name='{data['name']}', gate='{data['knowledge_gate']}'")
    
    def test_put_bot_settings(self, auth_token, org_and_bot):
        """PUT /api/v2/orgs/{org_id}/bots/{bot_id}/settings saves settings."""
        org_id = org_and_bot["org_id"]
        bot_id = org_and_bot["bot_id"]
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Org-ID": org_id
        }
        # Get current settings first
        resp = requests.get(f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/settings", headers=headers)
        current = resp.json()
        
        # Update persona (then restore)
        original_persona = current.get("persona", "")
        test_persona = "TEST_PERSONA_" + original_persona[:50]
        
        resp = requests.put(
            f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/settings",
            headers=headers,
            json={"persona": test_persona}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True
        
        # Verify change
        resp = requests.get(f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/settings", headers=headers)
        updated = resp.json()
        assert updated["persona"] == test_persona, "Persona not updated"
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/settings",
            headers=headers,
            json={"persona": original_persona}
        )
        print("✓ PUT bot settings saves and persists changes")


class TestV2BotTemplates:
    """Test V2 bot template endpoints."""
    
    def test_save_as_template(self, auth_token, org_and_bot):
        """POST /api/v2/orgs/{org_id}/bots/{bot_id}/save-as-template creates template."""
        org_id = org_and_bot["org_id"]
        bot_id = org_and_bot["bot_id"]
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Org-ID": org_id
        }
        resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/save-as-template",
            headers=headers,
            json={"name": "TEST_Template_Iter77", "description": "Test template"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data["name"] == "TEST_Template_Iter77"
        template_id = data["id"]
        print(f"✓ Save as template created template id={template_id}")
        
        # Cleanup: delete the test template
        requests.delete(f"{BASE_URL}/api/v2/orgs/{org_id}/templates/{template_id}", headers=headers)
    
    def test_list_templates(self, auth_token, org_and_bot):
        """GET /api/v2/orgs/{org_id}/templates lists templates."""
        org_id = org_and_bot["org_id"]
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Org-ID": org_id
        }
        resp = requests.get(f"{BASE_URL}/api/v2/orgs/{org_id}/templates", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "templates" in data
        print(f"✓ List templates returns {len(data['templates'])} templates")


class TestV2BotCRUD:
    """Test V2 bot CRUD operations."""
    
    def test_list_bots(self, auth_token, org_and_bot):
        """GET /api/v2/orgs/{org_id}/bots lists bots."""
        org_id = org_and_bot["org_id"]
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Org-ID": org_id
        }
        resp = requests.get(f"{BASE_URL}/api/v2/orgs/{org_id}/bots", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "bots" in data
        assert len(data["bots"]) > 0
        print(f"✓ List bots returns {len(data['bots'])} bots")
    
    def test_clone_bot(self, auth_token, org_and_bot):
        """POST /api/v2/orgs/{org_id}/bots/{bot_id}/clone clones a bot."""
        org_id = org_and_bot["org_id"]
        bot_id = org_and_bot["bot_id"]
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Org-ID": org_id
        }
        resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{bot_id}/clone",
            headers=headers
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert "(Copy)" in data["name"]
        cloned_id = data["id"]
        print(f"✓ Clone bot created '{data['name']}' (id={cloned_id})")
        
        # Cleanup: delete the cloned bot
        requests.delete(f"{BASE_URL}/api/v2/orgs/{org_id}/bots/{cloned_id}", headers=headers)


class TestChatEndpoints:
    """Test chat endpoints work with V2 bot IDs."""
    
    def test_chat_send(self, org_and_bot):
        """POST /api/chat/send works with bot_id as instance_id."""
        bot_id = org_and_bot["bot_id"]
        resp = requests.post(f"{BASE_URL}/api/chat/send", json={
            "message": "Hello, this is a test",
            "instance_id": bot_id
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "response" in data
        assert "session_id" in data
        print(f"✓ Chat send works with V2 bot_id, got response: {data['response'][:50]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
