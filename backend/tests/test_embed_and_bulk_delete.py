"""
Test suite for:
1. Embed Code page backend endpoints (GET /api/embed/config/{id}, PUT /api/admin/embed-config, GET /api/embed.js)
2. Bulk Delete for Knowledge Sources (POST /api/knowledge/sources/bulk-delete)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b57298fd57073"  # Test instance from credentials

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": "administrator",
        "password": "Admin@123"
    })
    if resp.status_code == 200:
        return resp.json().get("token")
    pytest.skip(f"Authentication failed: {resp.status_code} - {resp.text}")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token and instance ID."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Instance-ID": INSTANCE_ID,
        "Content-Type": "application/json"
    }


# ==================== EMBED CONFIG TESTS ====================

class TestEmbedConfigEndpoints:
    """Tests for embed configuration endpoints."""
    
    def test_get_embed_config_public(self):
        """GET /api/embed/config/{instance_id} - Public endpoint returns config."""
        resp = requests.get(f"{BASE_URL}/api/embed/config/{INSTANCE_ID}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "instance_id" in data or "custom_css_url" in data or data == {"instance_id": INSTANCE_ID, "custom_css_url": "", "theme": {}}
        print(f"GET embed config: {data}")
    
    def test_get_embed_config_nonexistent_instance(self):
        """GET /api/embed/config/{instance_id} - Returns default for nonexistent instance."""
        fake_id = str(uuid.uuid4())
        resp = requests.get(f"{BASE_URL}/api/embed/config/{fake_id}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        # Should return default empty config
        assert data.get("custom_css_url") == "" or data.get("custom_css_url") is None
        print(f"Nonexistent instance config: {data}")
    
    def test_put_embed_config_requires_auth(self):
        """PUT /api/admin/embed-config - Requires authentication."""
        resp = requests.put(f"{BASE_URL}/api/admin/embed-config", json={
            "custom_css_url": "https://example.com/test.css"
        })
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("PUT embed-config correctly requires auth")
    
    def test_put_embed_config_requires_instance_header(self, auth_token):
        """PUT /api/admin/embed-config - Requires X-Instance-ID header."""
        resp = requests.put(
            f"{BASE_URL}/api/admin/embed-config",
            headers={"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"},
            json={"custom_css_url": "https://example.com/test.css"}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print("PUT embed-config correctly requires X-Instance-ID")
    
    def test_put_embed_config_save_css_url(self, auth_headers):
        """PUT /api/admin/embed-config - Save custom CSS URL and verify persistence."""
        test_css_url = f"https://example.com/test-{uuid.uuid4().hex[:8]}.css"
        
        # Save the CSS URL
        resp = requests.put(
            f"{BASE_URL}/api/admin/embed-config",
            headers=auth_headers,
            json={"custom_css_url": test_css_url}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("custom_css_url") == test_css_url, f"CSS URL not saved correctly: {data}"
        print(f"Saved CSS URL: {test_css_url}")
        
        # Verify via GET (public endpoint)
        resp2 = requests.get(f"{BASE_URL}/api/embed/config/{INSTANCE_ID}")
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2.get("custom_css_url") == test_css_url, f"CSS URL not persisted: {data2}"
        print(f"Verified CSS URL persisted: {data2}")
    
    def test_put_embed_config_clear_css_url(self, auth_headers):
        """PUT /api/admin/embed-config - Clear CSS URL by setting empty string."""
        # Clear the CSS URL
        resp = requests.put(
            f"{BASE_URL}/api/admin/embed-config",
            headers=auth_headers,
            json={"custom_css_url": ""}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("custom_css_url") == "", f"CSS URL not cleared: {data}"
        print("CSS URL cleared successfully")


class TestEmbedJsEndpoint:
    """Tests for the embed.js JavaScript loader endpoint."""
    
    def test_embed_js_popup_mode(self):
        """GET /api/embed.js - Returns valid JS for popup mode."""
        resp = requests.get(f"{BASE_URL}/api/embed.js?instance={INSTANCE_ID}&mode=popup")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert "application/javascript" in resp.headers.get("content-type", "")
        content = resp.text
        assert "BRIDGE_INSTANCE" in content, "Missing BRIDGE_INSTANCE variable"
        assert "BRIDGE_MODE" in content, "Missing BRIDGE_MODE variable"
        assert '"popup"' in content, "Mode should be popup"
        assert "bridgebot-popup-trigger" in content, "Missing popup trigger element"
        print("embed.js popup mode: valid JS returned")
    
    def test_embed_js_inline_mode(self):
        """GET /api/embed.js - Returns valid JS for inline mode."""
        resp = requests.get(f"{BASE_URL}/api/embed.js?instance={INSTANCE_ID}&mode=inline")
        assert resp.status_code == 200
        content = resp.text
        assert '"inline"' in content, "Mode should be inline"
        assert "bridgebot-container" in content, "Missing container reference"
        assert "bridgebot-inline-iframe" in content, "Missing inline iframe testid"
        print("embed.js inline mode: valid JS returned")
    
    def test_embed_js_fullpage_mode(self):
        """GET /api/embed.js - Returns valid JS for fullpage mode."""
        resp = requests.get(f"{BASE_URL}/api/embed.js?instance={INSTANCE_ID}&mode=fullpage")
        assert resp.status_code == 200
        content = resp.text
        assert '"fullpage"' in content, "Mode should be fullpage"
        assert "bridgebot-fullpage-iframe" in content, "Missing fullpage iframe testid"
        print("embed.js fullpage mode: valid JS returned")
    
    def test_embed_js_default_mode(self):
        """GET /api/embed.js - Defaults to popup mode when mode not specified."""
        resp = requests.get(f"{BASE_URL}/api/embed.js?instance={INSTANCE_ID}")
        assert resp.status_code == 200
        content = resp.text
        # Default mode is popup
        assert "bridgebot-popup-trigger" in content or '"popup"' in content
        print("embed.js default mode: popup")


# ==================== BULK DELETE TESTS ====================

class TestBulkDeleteEndpoint:
    """Tests for bulk delete knowledge sources endpoint."""
    
    def test_bulk_delete_requires_auth(self):
        """POST /api/knowledge/sources/bulk-delete - Requires authentication."""
        resp = requests.post(f"{BASE_URL}/api/knowledge/sources/bulk-delete", json={
            "items": [{"type": "source", "id": "test-id"}]
        })
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("Bulk delete correctly requires auth")
    
    def test_bulk_delete_requires_instance_header(self, auth_token):
        """POST /api/knowledge/sources/bulk-delete - Requires X-Instance-ID header."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/bulk-delete",
            headers={"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"},
            json={"items": [{"type": "source", "id": "test-id"}]}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print("Bulk delete correctly requires X-Instance-ID")
    
    def test_bulk_delete_empty_items(self, auth_headers):
        """POST /api/knowledge/sources/bulk-delete - Returns error for empty items."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/bulk-delete",
            headers=auth_headers,
            json={"items": []}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print("Bulk delete correctly rejects empty items")
    
    def test_bulk_delete_nonexistent_sources(self, auth_headers):
        """POST /api/knowledge/sources/bulk-delete - Handles nonexistent sources gracefully."""
        fake_ids = [str(uuid.uuid4()) for _ in range(3)]
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/bulk-delete",
            headers=auth_headers,
            json={"items": [{"type": "source", "id": fid} for fid in fake_ids]}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        assert data.get("deleted") == 0, "Should delete 0 nonexistent sources"
        print(f"Bulk delete nonexistent: {data}")
    
    def test_bulk_delete_create_and_delete_faq(self, auth_headers):
        """POST /api/knowledge/sources/bulk-delete - Create FAQ then bulk delete it."""
        # Create a test FAQ
        test_title = f"TEST_BulkDelete_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/faq",
            headers=auth_headers,
            json={"title": test_title, "content": "Test content for bulk delete", "priority": 0}
        )
        assert create_resp.status_code == 200, f"Failed to create FAQ: {create_resp.text}"
        created = create_resp.json()
        source_id = created.get("id")
        assert source_id, f"No ID returned: {created}"
        print(f"Created test FAQ: {source_id}")
        
        # Verify it exists
        sources_resp = requests.get(f"{BASE_URL}/api/knowledge/sources", headers=auth_headers)
        assert sources_resp.status_code == 200
        sources = sources_resp.json()
        found = any(s.get("id") == source_id or (s.get("parts") and source_id in s.get("parts", [])) for s in sources)
        assert found, f"Created source not found in list"
        
        # Bulk delete it
        delete_resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/bulk-delete",
            headers=auth_headers,
            json={"items": [{"type": "source", "id": source_id}]}
        )
        assert delete_resp.status_code == 200, f"Bulk delete failed: {delete_resp.text}"
        data = delete_resp.json()
        assert data.get("success") == True
        assert data.get("deleted") >= 1, f"Should delete at least 1 source: {data}"
        print(f"Bulk deleted: {data}")
        
        # Verify it's gone
        sources_resp2 = requests.get(f"{BASE_URL}/api/knowledge/sources", headers=auth_headers)
        sources2 = sources_resp2.json()
        still_found = any(s.get("id") == source_id or (s.get("parts") and source_id in s.get("parts", [])) for s in sources2)
        assert not still_found, "Source should be deleted"
        print("Verified source deleted")
    
    def test_bulk_delete_multiple_sources(self, auth_headers):
        """POST /api/knowledge/sources/bulk-delete - Delete multiple FAQs at once."""
        # Create multiple test FAQs
        created_ids = []
        for i in range(3):
            test_title = f"TEST_BulkMulti_{i}_{uuid.uuid4().hex[:6]}"
            resp = requests.post(
                f"{BASE_URL}/api/knowledge/sources/faq",
                headers=auth_headers,
                json={"title": test_title, "content": f"Test content {i}", "priority": 0}
            )
            if resp.status_code == 200:
                created_ids.append(resp.json().get("id"))
        
        assert len(created_ids) >= 2, f"Need at least 2 sources, created {len(created_ids)}"
        print(f"Created {len(created_ids)} test FAQs")
        
        # Bulk delete all
        delete_resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/bulk-delete",
            headers=auth_headers,
            json={"items": [{"type": "source", "id": sid} for sid in created_ids]}
        )
        assert delete_resp.status_code == 200, f"Bulk delete failed: {delete_resp.text}"
        data = delete_resp.json()
        assert data.get("success") == True
        assert data.get("deleted") >= len(created_ids), f"Should delete {len(created_ids)} sources: {data}"
        print(f"Bulk deleted {data.get('deleted')} sources")
    
    def test_bulk_delete_group_type(self, auth_headers):
        """POST /api/knowledge/sources/bulk-delete - Delete by group type."""
        # This tests the group deletion path (for URL scrapes with multiple chunks)
        fake_group_id = f"test-group-{uuid.uuid4().hex[:8]}"
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/bulk-delete",
            headers=auth_headers,
            json={"items": [{"type": "group", "id": fake_group_id}]}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        # Nonexistent group should delete 0
        assert data.get("deleted") == 0
        print(f"Group delete (nonexistent): {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
