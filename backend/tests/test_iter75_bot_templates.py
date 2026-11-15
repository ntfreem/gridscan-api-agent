"""
Test Bot Templates Feature - Iteration 75
Tests:
1. POST /api/v2/orgs/{org_id}/bots/{bot_id}/save-as-template - Save bot as template
2. GET /api/v2/orgs/{org_id}/templates - List templates
3. POST /api/v2/orgs/{org_id}/templates/{template_id}/create-bot - Create bot from template
4. DELETE /api/v2/orgs/{org_id}/templates/{template_id} - Delete template
5. Pruned V1 endpoints return 404
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"


class TestBotTemplates:
    """Test Bot Templates CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get org/bot IDs"""
        # Login
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email_or_username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Get org ID
        orgs_resp = requests.get(f"{BASE_URL}/api/v2/orgs", headers=self.headers)
        assert orgs_resp.status_code == 200, f"Failed to get orgs: {orgs_resp.text}"
        orgs = orgs_resp.json().get("organisations", [])
        assert len(orgs) > 0, "No orgs found"
        self.org_id = orgs[0]["id"]
        self.headers["X-Org-ID"] = self.org_id
        
        # Get bot ID (use existing bot)
        bots_resp = requests.get(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots",
            headers=self.headers
        )
        assert bots_resp.status_code == 200, f"Failed to get bots: {bots_resp.text}"
        bots = bots_resp.json().get("bots", [])
        assert len(bots) > 0, "No bots found"
        self.bot_id = bots[0]["id"]
        self.bot_name = bots[0]["name"]
        
        # Track created templates for cleanup
        self.created_template_ids = []
        self.created_bot_ids = []
        
        yield
        
        # Cleanup: Delete created templates and bots
        for tpl_id in self.created_template_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/v2/orgs/{self.org_id}/templates/{tpl_id}",
                    headers=self.headers
                )
            except Exception:
                pass
        
        for bot_id in self.created_bot_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{bot_id}",
                    headers=self.headers
                )
            except Exception:
                pass
    
    def test_01_save_bot_as_template(self):
        """Test POST /api/v2/orgs/{org_id}/bots/{bot_id}/save-as-template"""
        template_name = f"TEST_Template_{uuid.uuid4().hex[:8]}"
        
        resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{self.bot_id}/save-as-template",
            headers=self.headers,
            json={"name": template_name, "description": "Test template description"}
        )
        
        assert resp.status_code == 200, f"Failed to save template: {resp.text}"
        data = resp.json()
        
        # Verify template structure
        assert "id" in data, "Template should have an id"
        assert data["name"] == template_name, f"Template name mismatch: {data['name']}"
        assert data["org_id"] == self.org_id, "Org ID mismatch"
        assert data["source_bot_id"] == self.bot_id, "Source bot ID mismatch"
        assert "persona" in data, "Template should have persona"
        assert "knowledge_gate" in data, "Template should have knowledge_gate"
        assert "tone_instructions" in data, "Template should have tone_instructions"
        assert "llm_config" in data, "Template should have llm_config"
        
        self.created_template_ids.append(data["id"])
        print(f"✓ Template created: {data['id']} with name '{template_name}'")
    
    def test_02_list_templates(self):
        """Test GET /api/v2/orgs/{org_id}/templates"""
        # First create a template
        template_name = f"TEST_ListTemplate_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{self.bot_id}/save-as-template",
            headers=self.headers,
            json={"name": template_name}
        )
        assert create_resp.status_code == 200
        created_tpl = create_resp.json()
        self.created_template_ids.append(created_tpl["id"])
        
        # List templates
        resp = requests.get(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/templates",
            headers=self.headers
        )
        
        assert resp.status_code == 200, f"Failed to list templates: {resp.text}"
        data = resp.json()
        
        assert "templates" in data, "Response should have 'templates' key"
        templates = data["templates"]
        assert isinstance(templates, list), "Templates should be a list"
        
        # Find our created template
        found = any(t["id"] == created_tpl["id"] for t in templates)
        assert found, f"Created template {created_tpl['id']} not found in list"
        
        print(f"✓ Listed {len(templates)} templates, found created template")
    
    def test_03_create_bot_from_template(self):
        """Test POST /api/v2/orgs/{org_id}/templates/{template_id}/create-bot"""
        # First create a template
        template_name = f"TEST_SourceTemplate_{uuid.uuid4().hex[:8]}"
        create_tpl_resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{self.bot_id}/save-as-template",
            headers=self.headers,
            json={"name": template_name}
        )
        assert create_tpl_resp.status_code == 200
        template = create_tpl_resp.json()
        self.created_template_ids.append(template["id"])
        
        # Create bot from template
        new_bot_name = f"TEST_BotFromTemplate_{uuid.uuid4().hex[:8]}"
        resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/templates/{template['id']}/create-bot",
            headers=self.headers,
            json={"name": new_bot_name}
        )
        
        assert resp.status_code == 200, f"Failed to create bot from template: {resp.text}"
        new_bot = resp.json()
        
        # Verify bot structure
        assert "id" in new_bot, "New bot should have an id"
        assert new_bot["name"] == new_bot_name, f"Bot name mismatch: {new_bot['name']}"
        assert new_bot["org_id"] == self.org_id, "Org ID mismatch"
        assert new_bot.get("created_from_template") == template["id"], "Should reference source template"
        assert new_bot.get("connection_count") == 0, "New bot should have 0 connections"
        
        # Verify settings were copied from template
        assert "persona" in new_bot, "Bot should have persona from template"
        assert "knowledge_gate" in new_bot, "Bot should have knowledge_gate from template"
        
        self.created_bot_ids.append(new_bot["id"])
        print(f"✓ Bot created from template: {new_bot['id']} with name '{new_bot_name}'")
    
    def test_04_delete_template(self):
        """Test DELETE /api/v2/orgs/{org_id}/templates/{template_id}"""
        # First create a template
        template_name = f"TEST_DeleteTemplate_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{self.bot_id}/save-as-template",
            headers=self.headers,
            json={"name": template_name}
        )
        assert create_resp.status_code == 200
        template = create_resp.json()
        
        # Delete template
        resp = requests.delete(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/templates/{template['id']}",
            headers=self.headers
        )
        
        assert resp.status_code == 200, f"Failed to delete template: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True, "Delete should return ok: true"
        
        # Verify template is gone
        list_resp = requests.get(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/templates",
            headers=self.headers
        )
        templates = list_resp.json().get("templates", [])
        found = any(t["id"] == template["id"] for t in templates)
        assert not found, "Deleted template should not appear in list"
        
        print(f"✓ Template deleted: {template['id']}")
    
    def test_05_delete_nonexistent_template_returns_404(self):
        """Test DELETE /api/v2/orgs/{org_id}/templates/{template_id} with invalid ID"""
        fake_id = str(uuid.uuid4())
        resp = requests.delete(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/templates/{fake_id}",
            headers=self.headers
        )
        
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("✓ Delete nonexistent template returns 404")
    
    def test_06_create_bot_from_nonexistent_template_returns_404(self):
        """Test POST /api/v2/orgs/{org_id}/templates/{template_id}/create-bot with invalid ID"""
        fake_id = str(uuid.uuid4())
        resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/templates/{fake_id}/create-bot",
            headers=self.headers,
            json={"name": "Test Bot"}
        )
        
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("✓ Create bot from nonexistent template returns 404")


class TestPrunedV1Endpoints:
    """Test that pruned V1 endpoints return 404"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login"""
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email_or_username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        # V1 Instance ID from test context
        self.v1_instance_id = "88bfae82-2533-4235-968d-b3298fd57073"
        self.headers["X-Instance-ID"] = self.v1_instance_id
    
    def test_pruned_api_test_endpoint(self):
        """Test POST /api/admin/api-test returns 404 (pruned)"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/api-test",
            headers=self.headers,
            json={"test": "data"}
        )
        
        assert resp.status_code == 404, f"Expected 404 for pruned endpoint, got {resp.status_code}: {resp.text}"
        print("✓ POST /api/admin/api-test returns 404 (pruned)")
    
    def test_pruned_llm_config_test_endpoint(self):
        """Test POST /api/admin/instances/{id}/llm-config/test returns 404 (pruned)"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/instances/{self.v1_instance_id}/llm-config/test",
            headers=self.headers,
            json={}
        )
        
        assert resp.status_code == 404, f"Expected 404 for pruned endpoint, got {resp.status_code}: {resp.text}"
        print("✓ POST /api/admin/instances/{id}/llm-config/test returns 404 (pruned)")
    
    def test_pruned_assign_user_endpoint(self):
        """Test POST /api/admin/instances/{id}/assign-user returns 404 (pruned)"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/instances/{self.v1_instance_id}/assign-user",
            headers=self.headers,
            json={"user_id": "test"}
        )
        
        assert resp.status_code == 404, f"Expected 404 for pruned endpoint, got {resp.status_code}: {resp.text}"
        print("✓ POST /api/admin/instances/{id}/assign-user returns 404 (pruned)")
    
    def test_pruned_reply_defaults_endpoint(self):
        """Test GET /api/admin/instances/{id}/reply-defaults returns 404 (pruned)"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/instances/{self.v1_instance_id}/reply-defaults",
            headers=self.headers
        )
        
        assert resp.status_code == 404, f"Expected 404 for pruned endpoint, got {resp.status_code}: {resp.text}"
        print("✓ GET /api/admin/instances/{id}/reply-defaults returns 404 (pruned)")


class TestTemplateFieldsCopied:
    """Test that template correctly copies all bot config fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get org/bot IDs"""
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email_or_username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        )
        assert login_resp.status_code == 200
        self.token = login_resp.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        orgs_resp = requests.get(f"{BASE_URL}/api/v2/orgs", headers=self.headers)
        self.org_id = orgs_resp.json()["organisations"][0]["id"]
        self.headers["X-Org-ID"] = self.org_id
        
        bots_resp = requests.get(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots",
            headers=self.headers
        )
        self.bot_id = bots_resp.json()["bots"][0]["id"]
        
        self.created_template_ids = []
        self.created_bot_ids = []
        
        yield
        
        for tpl_id in self.created_template_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/v2/orgs/{self.org_id}/templates/{tpl_id}",
                    headers=self.headers
                )
            except Exception:
                pass
        
        for bot_id in self.created_bot_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{bot_id}",
                    headers=self.headers
                )
            except Exception:
                pass
    
    def test_template_copies_all_config_fields(self):
        """Test that template includes persona, knowledge_gate, tone_instructions, llm_config"""
        # Get source bot settings
        bot_settings_resp = requests.get(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{self.bot_id}/settings",
            headers=self.headers
        )
        assert bot_settings_resp.status_code == 200
        source_settings = bot_settings_resp.json()
        
        # Create template
        template_name = f"TEST_FieldsTemplate_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{self.bot_id}/save-as-template",
            headers=self.headers,
            json={"name": template_name}
        )
        assert create_resp.status_code == 200
        template = create_resp.json()
        self.created_template_ids.append(template["id"])
        
        # Verify template has all expected fields
        expected_fields = [
            "persona", "custom_instructions", "tone_instructions",
            "manual_tone_examples", "knowledge_gate", "knowledge_gate_pct",
            "fallback_message", "acknowledgment_replies", "llm_config"
        ]
        
        for field in expected_fields:
            assert field in template, f"Template missing field: {field}"
        
        # Verify values match source bot
        assert template["persona"] == source_settings.get("persona", ""), "Persona mismatch"
        assert template["knowledge_gate"] == source_settings.get("knowledge_gate", "strict"), "Knowledge gate mismatch"
        
        print(f"✓ Template correctly copies all config fields: {expected_fields}")
    
    def test_bot_from_template_inherits_settings(self):
        """Test that bot created from template inherits all settings"""
        # Create template
        template_name = f"TEST_InheritTemplate_{uuid.uuid4().hex[:8]}"
        create_tpl_resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{self.bot_id}/save-as-template",
            headers=self.headers,
            json={"name": template_name}
        )
        assert create_tpl_resp.status_code == 200
        template = create_tpl_resp.json()
        self.created_template_ids.append(template["id"])
        
        # Create bot from template
        new_bot_name = f"TEST_InheritBot_{uuid.uuid4().hex[:8]}"
        create_bot_resp = requests.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/templates/{template['id']}/create-bot",
            headers=self.headers,
            json={"name": new_bot_name}
        )
        assert create_bot_resp.status_code == 200
        new_bot = create_bot_resp.json()
        self.created_bot_ids.append(new_bot["id"])
        
        # Get new bot settings
        new_bot_settings_resp = requests.get(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{new_bot['id']}/settings",
            headers=self.headers
        )
        assert new_bot_settings_resp.status_code == 200
        new_settings = new_bot_settings_resp.json()
        
        # Verify settings match template
        assert new_settings["persona"] == template["persona"], "Persona not inherited"
        assert new_settings["knowledge_gate"] == template["knowledge_gate"], "Knowledge gate not inherited"
        assert new_settings.get("tone_instructions") == template.get("tone_instructions"), "Tone instructions not inherited"
        
        print(f"✓ Bot created from template correctly inherits settings")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
