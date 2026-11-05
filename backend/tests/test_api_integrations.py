"""
Test API Integrations CRUD, connection testing, and chat endpoints.
Tests the new multi-API integration system and OpenAI provider support.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

# Test credentials
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token and instance ID."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
        "X-Instance-ID": INSTANCE_ID
    }


@pytest.fixture(scope="module")
def created_integration_ids():
    """Track test-created integrations for cleanup."""
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_integrations(auth_headers, created_integration_ids):
    """Delete only the integrations this test module created."""
    yield
    if not created_integration_ids:
        return
    for intg_id in created_integration_ids:
        try:
            requests.delete(f"{BASE_URL}/api/integrations/{intg_id}", headers=auth_headers)
        except Exception:
            pass


class TestAuthAndHealth:
    """Basic auth and health checks."""
    
    def test_login_success(self):
        """Test admin login works."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert len(data["token"]) > 0, "Empty token"
        print(f"Login successful, token prefix: {data['token'][:20]}...")
    
    def test_health_endpoint(self):
        """Test health endpoint."""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("Health check passed")


class TestIntegrationsCRUD:
    """Test API Integrations CRUD operations."""
    
    def test_list_integrations_empty_or_existing(self, auth_headers):
        """Test GET /api/integrations returns array."""
        response = requests.get(f"{BASE_URL}/api/integrations", headers=auth_headers)
        assert response.status_code == 200, f"List failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Found {len(data)} existing integrations")
    
    def test_create_integration(self, auth_headers, created_integration_ids):
        """Test POST /api/integrations creates new integration."""
        payload = {
            "name": "TEST_JSONPlaceholder",
            "description": "Test API for automated testing",
            "base_url": "https://jsonplaceholder.typicode.com",
            "auth_type": "none",
            "doc_source_type": "manual",
            "enabled": True
        }
        response = requests.post(f"{BASE_URL}/api/integrations", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "No id in response"
        assert data["name"] == payload["name"], f"Name mismatch: {data['name']}"
        assert data["base_url"] == payload["base_url"], f"URL mismatch: {data['base_url']}"
        assert data["auth_type"] == "none", f"Auth type mismatch: {data['auth_type']}"
        assert data["enabled"] == True, "Integration not enabled"
        
        created_integration_ids.append(data["id"])
        print(f"Created integration: {data['id']}")
        return data["id"]
    
    def test_get_integration(self, auth_headers, created_integration_ids):
        """Test GET /api/integrations/{id} returns integration."""
        if not created_integration_ids:
            pytest.skip("No integration created")
        
        intg_id = created_integration_ids[0]
        response = requests.get(f"{BASE_URL}/api/integrations/{intg_id}", headers=auth_headers)
        assert response.status_code == 200, f"Get failed: {response.text}"
        data = response.json()
        assert data["id"] == intg_id, "ID mismatch"
        assert "name" in data, "No name in response"
        print(f"Got integration: {data['name']}")
    
    def test_update_integration(self, auth_headers, created_integration_ids):
        """Test PUT /api/integrations/{id} updates integration."""
        if not created_integration_ids:
            pytest.skip("No integration created")
        
        intg_id = created_integration_ids[0]
        new_name = "TEST_JSONPlaceholder_Updated"
        payload = {"name": new_name}
        
        response = requests.put(f"{BASE_URL}/api/integrations/{intg_id}", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert data["name"] == new_name, f"Name not updated: {data['name']}"
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/integrations/{intg_id}", headers=auth_headers)
        assert get_response.status_code == 200
        assert get_response.json()["name"] == new_name, "Update not persisted"
        print(f"Updated integration name to: {new_name}")
    
    def test_test_connection(self, auth_headers, created_integration_ids):
        """Test POST /api/integrations/{id}/test-connection."""
        if not created_integration_ids:
            pytest.skip("No integration created")
        
        intg_id = created_integration_ids[0]
        response = requests.post(f"{BASE_URL}/api/integrations/{intg_id}/test-connection", headers=auth_headers)
        assert response.status_code == 200, f"Test connection failed: {response.text}"
        data = response.json()
        
        # JSONPlaceholder should return success
        assert "success" in data, "No success field"
        assert "status" in data, "No status field"
        print(f"Connection test result: success={data['success']}, status={data.get('status')}")
        
        # JSONPlaceholder returns 200
        if data["success"]:
            assert data["status"] == 200, f"Expected 200, got {data['status']}"
    
    def test_get_activity(self, auth_headers, created_integration_ids):
        """Test GET /api/integrations/{id}/activity returns logs."""
        if not created_integration_ids:
            pytest.skip("No integration created")
        
        intg_id = created_integration_ids[0]
        response = requests.get(f"{BASE_URL}/api/integrations/{intg_id}/activity", headers=auth_headers)
        assert response.status_code == 200, f"Get activity failed: {response.text}"
        data = response.json()
        assert "logs" in data, "No logs field"
        assert isinstance(data["logs"], list), "Logs not a list"
        print(f"Activity logs count: {len(data['logs'])}")
    
    def test_get_stats(self, auth_headers, created_integration_ids):
        """Test GET /api/integrations/{id}/stats returns stats."""
        if not created_integration_ids:
            pytest.skip("No integration created")
        
        intg_id = created_integration_ids[0]
        response = requests.get(f"{BASE_URL}/api/integrations/{intg_id}/stats", headers=auth_headers)
        assert response.status_code == 200, f"Get stats failed: {response.text}"
        data = response.json()
        assert "total_requests" in data, "No total_requests field"
        print(f"Stats: {data}")
    
    def test_delete_integration(self, auth_headers, created_integration_ids):
        """Test DELETE /api/integrations/{id} removes integration."""
        if not created_integration_ids:
            pytest.skip("No integration created")
        
        intg_id = created_integration_ids[0]
        response = requests.delete(f"{BASE_URL}/api/integrations/{intg_id}", headers=auth_headers)
        assert response.status_code == 200, f"Delete failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Delete not successful"
        
        # Verify with GET - should return 404
        get_response = requests.get(f"{BASE_URL}/api/integrations/{intg_id}", headers=auth_headers)
        assert get_response.status_code == 404, "Integration still exists after delete"
        
        # Remove from tracking since it's deleted
        created_integration_ids.remove(intg_id)
        print(f"Deleted integration: {intg_id}")


class TestChatEndpoints:
    """Test chat endpoints return proper responses."""
    
    def test_chat_send_returns_string(self):
        """Test POST /api/chat/send returns proper string response."""
        payload = {
            "message": "hello",
            "instance_id": INSTANCE_ID
        }
        response = requests.post(f"{BASE_URL}/api/chat/send", json=payload)
        assert response.status_code == 200, f"Chat send failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "response" in data, f"No 'response' field in: {data}"
        assert "session_id" in data, f"No 'session_id' field in: {data}"
        
        # Critical: response should be a string, not a tuple
        assert isinstance(data["response"], str), f"Response is not a string: {type(data['response'])} - {data['response']}"
        assert len(data["response"]) > 0, "Empty response"
        
        # Should not contain tuple indicators
        assert not data["response"].startswith("("), f"Response looks like a tuple: {data['response'][:100]}"
        
        print(f"Chat response (first 100 chars): {data['response'][:100]}...")
    
    def test_chat_history(self):
        """Test GET /api/chat/history/{session_id}."""
        # First send a message to create a session
        send_response = requests.post(f"{BASE_URL}/api/chat/send", json={
            "message": "test message for history",
            "instance_id": INSTANCE_ID
        })
        assert send_response.status_code == 200
        session_id = send_response.json()["session_id"]
        
        # Get history
        response = requests.get(f"{BASE_URL}/api/chat/history/{session_id}")
        assert response.status_code == 200, f"Get history failed: {response.text}"
        data = response.json()
        assert "messages" in data or "session_id" in data, f"Invalid history response: {data}"
        print(f"Chat history retrieved for session: {session_id}")


class TestLLMConfig:
    """Test LLM configuration endpoints."""
    
    def test_get_llm_config(self, auth_headers):
        """Test GET /api/admin/instances/{id}/llm-config."""
        response = requests.get(f"{BASE_URL}/api/admin/instances/{INSTANCE_ID}/llm-config", headers=auth_headers)
        assert response.status_code == 200, f"Get LLM config failed: {response.text}"
        data = response.json()
        
        # Verify expected fields
        assert "provider" in data, "No provider field"
        print(f"Current LLM provider: {data.get('provider')}")
        
        # Check for OpenAI fields
        if "allowed_openai_models" in data:
            print(f"OpenAI models available: {data['allowed_openai_models']}")
        if "default_models" in data:
            print(f"Default models: {data['default_models']}")
    
    def test_update_llm_config_emergent(self, auth_headers):
        """Test PUT /api/admin/instances/{id}/llm-config with Emergent provider."""
        payload = {
            "provider": "emergent",
            "model": None
        }
        response = requests.put(f"{BASE_URL}/api/admin/instances/{INSTANCE_ID}/llm-config", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Update LLM config failed: {response.text}"
        data = response.json()
        assert data.get("provider") == "emergent", f"Provider not set: {data}"
        print("LLM config updated to Emergent")


class TestAdminEndpoints:
    """Test admin endpoints."""
    
    def test_get_instances(self, auth_headers):
        """Test GET /api/admin/instances."""
        response = requests.get(f"{BASE_URL}/api/admin/instances", headers=auth_headers)
        assert response.status_code == 200, f"Get instances failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Found {len(data)} instances")
        
        # Find our test instance
        test_instance = next((i for i in data if i.get("id") == INSTANCE_ID), None)
        if test_instance:
            print(f"Test instance found: {test_instance.get('name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
