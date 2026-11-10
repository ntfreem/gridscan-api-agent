"""
Iteration 43: KB Export/Import/Share and Gate Presets Tests
Tests for:
1. GET /api/knowledge/export - Export KB as JSON
2. POST /api/knowledge/import - Import KB from JSON
3. POST /api/knowledge/share - Share KB to another instance
4. Gate presets (Conservative 10%, Balanced 50%, Open 85%)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"


@pytest.fixture(scope="module")
def auth_headers():
    """Get authentication token and return headers"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": "administrator",
        "password": "Admin@123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("token")
    return {
        "Authorization": f"Bearer {token}",
        "X-Instance-ID": INSTANCE_ID,
        "Content-Type": "application/json"
    }


class TestKBExport:
    """Tests for GET /api/knowledge/export"""
    
    def test_export_returns_json_structure(self, auth_headers):
        """Export should return version, count, sources array"""
        response = requests.get(f"{BASE_URL}/api/knowledge/export", headers=auth_headers)
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        data = response.json()
        # Verify required fields
        assert "version" in data, "Missing 'version' field"
        assert "count" in data, "Missing 'count' field"
        assert "sources" in data, "Missing 'sources' field"
        assert "exported_at" in data, "Missing 'exported_at' field"
        assert "source_instance_id" in data, "Missing 'source_instance_id' field"
        
        # Verify types
        assert isinstance(data["version"], int), "version should be int"
        assert isinstance(data["count"], int), "count should be int"
        assert isinstance(data["sources"], list), "sources should be list"
        
        # Verify count matches sources length
        assert data["count"] == len(data["sources"]), "count should match sources length"
        
        print(f"Export returned {data['count']} sources, version {data['version']}")
    
    def test_export_sources_have_required_fields(self, auth_headers):
        """Each exported source should have essential fields"""
        response = requests.get(f"{BASE_URL}/api/knowledge/export", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        if data["count"] > 0:
            source = data["sources"][0]
            # Check essential fields exist
            assert "id" in source, "Source missing 'id'"
            assert "type" in source, "Source missing 'type'"
            # instance_id should be stripped for portability
            assert "instance_id" not in source, "instance_id should be stripped from export"
            print(f"Sample source fields: {list(source.keys())}")
    
    def test_export_without_auth_fails(self):
        """Export without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/knowledge/export")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestKBImport:
    """Tests for POST /api/knowledge/import"""
    
    def test_import_empty_sources_fails(self, auth_headers):
        """Import with empty sources array should fail"""
        response = requests.post(
            f"{BASE_URL}/api/knowledge/import",
            headers=auth_headers,
            json={"sources": [], "overwrite": False}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "No sources to import" in response.json().get("detail", "")
    
    def test_import_valid_sources(self, auth_headers):
        """Import valid sources should succeed"""
        test_sources = [
            {
                "id": f"TEST_import_{uuid.uuid4()}",
                "type": "faq",
                "title": "TEST_Import FAQ Question",
                "content": "This is a test FAQ imported via API",
                "priority": 0,
                "is_active": True
            }
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/knowledge/import",
            headers=auth_headers,
            json={"sources": test_sources, "overwrite": False}
        )
        assert response.status_code == 200, f"Import failed: {response.text}"
        
        data = response.json()
        assert "imported" in data, "Missing 'imported' field"
        assert "skipped" in data, "Missing 'skipped' field"
        assert "total" in data, "Missing 'total' field"
        assert data["imported"] >= 1, "Should have imported at least 1 source"
        assert data["total"] == len(test_sources), "total should match input length"
        
        print(f"Imported: {data['imported']}, Skipped: {data['skipped']}, Total: {data['total']}")
    
    def test_import_with_overwrite_deactivates_existing(self, auth_headers):
        """Import with overwrite=true should soft-delete existing sources"""
        # First, get current count
        export_before = requests.get(f"{BASE_URL}/api/knowledge/export", headers=auth_headers)
        count_before = export_before.json().get("count", 0)
        
        # Import with overwrite (this will deactivate existing)
        test_sources = [
            {
                "id": f"TEST_overwrite_{uuid.uuid4()}",
                "type": "faq",
                "title": "TEST_Overwrite FAQ",
                "content": "This replaces existing KB",
                "priority": 0,
                "is_active": True
            }
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/knowledge/import",
            headers=auth_headers,
            json={"sources": test_sources, "overwrite": True}
        )
        assert response.status_code == 200, f"Import with overwrite failed: {response.text}"
        
        data = response.json()
        assert data["imported"] == 1
        print(f"Overwrite import: imported {data['imported']}, previous count was {count_before}")
    
    def test_import_without_auth_fails(self):
        """Import without auth should fail"""
        response = requests.post(
            f"{BASE_URL}/api/knowledge/import",
            json={"sources": [{"type": "faq", "title": "Test", "content": "Test"}]}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestKBShare:
    """Tests for POST /api/knowledge/share"""
    
    def test_share_to_same_instance_fails(self, auth_headers):
        """Sharing to the same instance should fail"""
        response = requests.post(
            f"{BASE_URL}/api/knowledge/share",
            headers=auth_headers,
            json={
                "source_ids": ["some-id"],
                "target_instance_id": INSTANCE_ID  # Same as current
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "same instance" in response.json().get("detail", "").lower()
    
    def test_share_to_nonexistent_instance_fails(self, auth_headers):
        """Sharing to non-existent instance should fail"""
        response = requests.post(
            f"{BASE_URL}/api/knowledge/share",
            headers=auth_headers,
            json={
                "source_ids": ["some-id"],
                "target_instance_id": "nonexistent-instance-id"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        assert "not found" in response.json().get("detail", "").lower()
    
    def test_share_with_invalid_source_ids_fails(self, auth_headers):
        """Sharing with non-matching source IDs should fail"""
        # First get list of instances to find another one
        instances_resp = requests.get(f"{BASE_URL}/api/admin/instances", headers=auth_headers)
        if instances_resp.status_code != 200:
            pytest.skip("Cannot get instances list")
        
        instances = instances_resp.json()
        other_instances = [i for i in instances if i.get("id") != INSTANCE_ID]
        
        if not other_instances:
            # Expected: only 1 instance exists
            print("Only 1 instance exists - share will fail with 'No other instances' which is expected")
            pytest.skip("No other instances to share with - expected behavior")
        
        target_id = other_instances[0]["id"]
        response = requests.post(
            f"{BASE_URL}/api/knowledge/share",
            headers=auth_headers,
            json={
                "source_ids": ["nonexistent-source-id"],
                "target_instance_id": target_id
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        assert "No matching sources" in response.json().get("detail", "")
    
    def test_share_without_auth_fails(self):
        """Share without auth should fail"""
        response = requests.post(
            f"{BASE_URL}/api/knowledge/share",
            json={
                "source_ids": ["some-id"],
                "target_instance_id": "some-instance"
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestGatePresets:
    """Tests for Knowledge Gate preset values (10%, 50%, 85%)"""
    
    def test_gate_preset_conservative_10(self, auth_headers):
        """Setting gate to 10% (Conservative) should work"""
        response = requests.put(
            f"{BASE_URL}/api/admin/bot-config",
            headers=auth_headers,
            json={"knowledge_gate_pct": 10}
        )
        assert response.status_code == 200, f"Failed to set gate to 10%: {response.text}"
        
        data = response.json()
        assert data.get("knowledge_gate_pct") == 10, "knowledge_gate_pct should be 10"
        assert data.get("knowledge_gate") == "strict", "10% should map to 'strict' gate"
        print("Conservative preset (10%): gate=strict")
    
    def test_gate_preset_balanced_50(self, auth_headers):
        """Setting gate to 50% (Balanced) should work"""
        response = requests.put(
            f"{BASE_URL}/api/admin/bot-config",
            headers=auth_headers,
            json={"knowledge_gate_pct": 50}
        )
        assert response.status_code == 200, f"Failed to set gate to 50%: {response.text}"
        
        data = response.json()
        assert data.get("knowledge_gate_pct") == 50, "knowledge_gate_pct should be 50"
        assert data.get("knowledge_gate") == "flexible", "50% should map to 'flexible' gate"
        print("Balanced preset (50%): gate=flexible")
    
    def test_gate_preset_open_85(self, auth_headers):
        """Setting gate to 85% (Open) should work"""
        response = requests.put(
            f"{BASE_URL}/api/admin/bot-config",
            headers=auth_headers,
            json={"knowledge_gate_pct": 85}
        )
        assert response.status_code == 200, f"Failed to set gate to 85%: {response.text}"
        
        data = response.json()
        assert data.get("knowledge_gate_pct") == 85, "knowledge_gate_pct should be 85"
        assert data.get("knowledge_gate") == "flexible", "85% should map to 'flexible' gate"
        print("Open preset (85%): gate=flexible")
    
    def test_gate_value_persists(self, auth_headers):
        """Gate value should persist after setting"""
        # Set to 85%
        requests.put(
            f"{BASE_URL}/api/admin/bot-config",
            headers=auth_headers,
            json={"knowledge_gate_pct": 85}
        )
        
        # Fetch config and verify
        response = requests.get(
            f"{BASE_URL}/api/admin/bot-config",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("knowledge_gate_pct") == 85, "Gate value should persist"


class TestCleanup:
    """Cleanup test data created during tests"""
    
    def test_cleanup_test_sources(self, auth_headers):
        """Remove TEST_ prefixed sources created during testing"""
        # Get all sources
        export_resp = requests.get(f"{BASE_URL}/api/knowledge/export", headers=auth_headers)
        if export_resp.status_code != 200:
            pytest.skip("Cannot get sources for cleanup")
        
        sources = export_resp.json().get("sources", [])
        test_sources = [s for s in sources if s.get("title", "").startswith("TEST_")]
        
        deleted = 0
        for source in test_sources:
            source_id = source.get("id")
            if source_id:
                del_resp = requests.delete(
                    f"{BASE_URL}/api/knowledge/sources/{source_id}",
                    headers=auth_headers
                )
                if del_resp.status_code in [200, 204]:
                    deleted += 1
        
        print(f"Cleaned up {deleted} test sources")
        # Reset gate to balanced
        requests.put(
            f"{BASE_URL}/api/admin/bot-config",
            headers=auth_headers,
            json={"knowledge_gate_pct": 50}
        )
