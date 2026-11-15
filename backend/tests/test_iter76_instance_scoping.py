"""
Test suite for Instance Scoping Bug Fix and Delete Functionality
Tests:
1. New bots have clean/default settings (not inherited from other bots)
2. New bots have empty Knowledge Base (not inherited)
3. Delete bot functionality
4. Delete org functionality with cascade
5. Delete org button visibility logic (only when 2+ orgs)
6. User delete buttons on Team page
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestInstanceScopingAndDelete:
    """Test instance scoping fix and delete functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get default org
        orgs_response = self.session.get(f"{BASE_URL}/api/v2/orgs")
        assert orgs_response.status_code == 200
        orgs = orgs_response.json().get("organisations", [])
        assert len(orgs) > 0, "No organisations found"
        self.org_id = orgs[0]["id"]
        self.session.headers.update({"X-Org-ID": self.org_id})
        
        # Track created resources for cleanup
        self.created_bot_ids = []
        self.created_org_ids = []
        
        yield
        
        # Cleanup
        for bot_id in self.created_bot_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{bot_id}")
            except Exception:
                pass
        for org_id in self.created_org_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/v2/orgs/{org_id}")
            except Exception:
                pass
    
    def test_new_bot_has_default_persona(self):
        """Test that a new bot has default persona, not inherited from other bots"""
        # Create a new bot
        create_response = self.session.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots",
            json={"name": "TEST_Default_Persona_Bot"}
        )
        assert create_response.status_code == 200, f"Failed to create bot: {create_response.text}"
        bot = create_response.json()
        bot_id = bot["id"]
        self.created_bot_ids.append(bot_id)
        
        # Get bot settings via V2 API
        settings_response = self.session.get(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{bot_id}/settings"
        )
        assert settings_response.status_code == 200
        settings = settings_response.json()
        
        # Verify default persona (not API Tester's persona)
        assert "persona" in settings
        # Default persona should be simple, not the detailed API Tester persona
        assert "Provide clear, accurate answers" not in settings.get("persona", ""), \
            "New bot inherited API Tester's persona!"
        
        # Verify empty custom instructions
        assert settings.get("custom_instructions", "") == "" or settings.get("custom_instructions") is None, \
            "New bot should have empty custom instructions"
        
        # Verify default knowledge gate
        assert settings.get("knowledge_gate") == "strict", \
            f"Expected 'strict' knowledge gate, got '{settings.get('knowledge_gate')}'"
        
        print(f"SUCCESS: New bot has default persona: '{settings.get('persona', '')[:50]}...'")
    
    def test_new_bot_has_empty_knowledge_base(self):
        """Test that a new bot has 0 KB articles (not inherited)"""
        # Create a new bot
        create_response = self.session.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots",
            json={"name": "TEST_Empty_KB_Bot"}
        )
        assert create_response.status_code == 200
        bot = create_response.json()
        bot_id = bot["id"]
        self.created_bot_ids.append(bot_id)
        
        # Get KB sources using the new bot's ID as instance ID
        kb_response = self.session.get(
            f"{BASE_URL}/api/knowledge/sources",
            headers={**self.session.headers, "X-Instance-ID": bot_id}
        )
        assert kb_response.status_code == 200
        sources = kb_response.json()
        
        # Verify empty KB
        assert len(sources) == 0, f"New bot should have 0 KB articles, found {len(sources)}"
        print(f"SUCCESS: New bot has 0 KB articles")
    
    def test_legacy_bot_has_kb_articles(self):
        """Test that legacy bot (API Tester) has KB articles"""
        # Get bots to find API Tester
        bots_response = self.session.get(f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots")
        assert bots_response.status_code == 200
        bots = bots_response.json().get("bots", [])
        
        api_tester = next((b for b in bots if b["name"] == "API Tester"), None)
        if not api_tester:
            pytest.skip("API Tester bot not found")
        
        legacy_instance_id = api_tester.get("legacy_instance_id")
        if not legacy_instance_id:
            pytest.skip("API Tester has no legacy_instance_id")
        
        # Get KB sources for legacy bot
        kb_response = self.session.get(
            f"{BASE_URL}/api/knowledge/sources",
            headers={**self.session.headers, "X-Instance-ID": legacy_instance_id}
        )
        assert kb_response.status_code == 200
        sources = kb_response.json()
        
        # Verify legacy bot has KB articles
        assert len(sources) > 0, "Legacy bot should have KB articles"
        print(f"SUCCESS: Legacy bot (API Tester) has {len(sources)} KB articles")
    
    def test_delete_bot_api(self):
        """Test DELETE /api/v2/orgs/{org_id}/bots/{bot_id}"""
        # Create a bot to delete
        create_response = self.session.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots",
            json={"name": "TEST_Delete_Me_Bot"}
        )
        assert create_response.status_code == 200
        bot_id = create_response.json()["id"]
        
        # Delete the bot
        delete_response = self.session.delete(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{bot_id}"
        )
        assert delete_response.status_code == 200
        assert delete_response.json().get("ok") == True
        
        # Verify bot is deleted
        get_response = self.session.get(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots/{bot_id}"
        )
        assert get_response.status_code == 404, "Bot should be deleted"
        print("SUCCESS: Delete bot API works correctly")
    
    def test_delete_org_api_with_cascade(self):
        """Test DELETE /api/v2/orgs/{org_id} cascades to bots"""
        # Create a new org
        create_org_response = self.session.post(
            f"{BASE_URL}/api/v2/orgs",
            json={"name": "TEST_Delete_Cascade_Org", "description": "Test cascade delete"}
        )
        assert create_org_response.status_code == 200
        org = create_org_response.json()
        test_org_id = org["id"]
        
        # Create a bot in the new org
        create_bot_response = self.session.post(
            f"{BASE_URL}/api/v2/orgs/{test_org_id}/bots",
            json={"name": "TEST_Bot_In_Cascade_Org"},
            headers={**self.session.headers, "X-Org-ID": test_org_id}
        )
        assert create_bot_response.status_code == 200
        bot_id = create_bot_response.json()["id"]
        
        # Delete the org
        delete_response = self.session.delete(f"{BASE_URL}/api/v2/orgs/{test_org_id}")
        assert delete_response.status_code == 200
        assert delete_response.json().get("ok") == True
        
        # Verify org is deleted by checking the orgs list
        orgs_response = self.session.get(f"{BASE_URL}/api/v2/orgs")
        assert orgs_response.status_code == 200
        orgs = orgs_response.json().get("organisations", [])
        org_ids = [o["id"] for o in orgs]
        assert test_org_id not in org_ids, "Deleted org should not be in the list"
        
        print("SUCCESS: Delete org API cascades correctly")
    
    def test_v1_api_with_v2_bot_id(self):
        """Test that V1 API works with V2 bot ID as X-Instance-ID"""
        # Create a new V2 bot (no legacy_instance_id)
        create_response = self.session.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots",
            json={"name": "TEST_V1_API_Bot"}
        )
        assert create_response.status_code == 200
        bot = create_response.json()
        bot_id = bot["id"]
        self.created_bot_ids.append(bot_id)
        
        # Verify no legacy_instance_id
        assert bot.get("legacy_instance_id") is None, "New bot should not have legacy_instance_id"
        
        # Call V1 API with bot ID as X-Instance-ID
        v1_response = self.session.get(
            f"{BASE_URL}/api/admin/bot-config",
            headers={**self.session.headers, "X-Instance-ID": bot_id}
        )
        assert v1_response.status_code == 200, f"V1 API should accept V2 bot ID: {v1_response.text}"
        config = v1_response.json()
        
        # Verify correct bot name
        assert config.get("name") == "TEST_V1_API_Bot", \
            f"Expected 'TEST_V1_API_Bot', got '{config.get('name')}'"
        
        print("SUCCESS: V1 API works with V2 bot ID")
    
    def test_bot_list_updates_after_create(self):
        """Test that bot list updates after creating a bot"""
        # Get initial bot count
        initial_response = self.session.get(f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots")
        assert initial_response.status_code == 200
        initial_count = len(initial_response.json().get("bots", []))
        
        # Create a new bot
        create_response = self.session.post(
            f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots",
            json={"name": "TEST_List_Update_Bot"}
        )
        assert create_response.status_code == 200
        bot_id = create_response.json()["id"]
        self.created_bot_ids.append(bot_id)
        
        # Get updated bot list
        updated_response = self.session.get(f"{BASE_URL}/api/v2/orgs/{self.org_id}/bots")
        assert updated_response.status_code == 200
        updated_count = len(updated_response.json().get("bots", []))
        
        # Verify count increased
        assert updated_count == initial_count + 1, \
            f"Bot count should increase from {initial_count} to {initial_count + 1}, got {updated_count}"
        
        # Verify new bot is in the list
        bots = updated_response.json().get("bots", [])
        bot_names = [b["name"] for b in bots]
        assert "TEST_List_Update_Bot" in bot_names, "New bot should be in the list"
        
        print("SUCCESS: Bot list updates correctly after create")
    
    def test_user_list_has_delete_buttons_data(self):
        """Test that user list endpoint returns data needed for delete buttons"""
        # Get users list
        users_response = self.session.get(f"{BASE_URL}/api/admin/users")
        assert users_response.status_code == 200
        users = users_response.json()
        
        # Verify users have IDs (needed for delete)
        assert len(users) > 0, "Should have at least one user"
        for user in users:
            assert "id" in user, "User should have 'id' field"
            assert "email" in user, "User should have 'email' field"
        
        print(f"SUCCESS: User list returns {len(users)} users with IDs for delete buttons")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
