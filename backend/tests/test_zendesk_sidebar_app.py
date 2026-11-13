"""
Test suite for Zendesk Sidebar App feature.
Tests the new sidebar endpoints:
- GET /api/admin/zendesk/sidebar-key
- POST /api/admin/zendesk/sidebar-key/regenerate
- POST /api/zendesk/sidebar/generate
- GET /api/admin/zendesk/sidebar-app.zip
"""
import pytest
import requests
import os
import zipfile
import io
import json

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_username": "administrator", "password": "Admin@123"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token and instance ID."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Instance-ID": INSTANCE_ID,
        "Content-Type": "application/json"
    }


class TestSidebarKeyEndpoints:
    """Tests for sidebar API key management endpoints."""

    def test_get_sidebar_key_returns_200_with_key(self, auth_headers):
        """GET /api/admin/zendesk/sidebar-key returns the sidebar API key."""
        response = requests.get(
            f"{BASE_URL}/api/admin/zendesk/sidebar-key",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "sidebar_api_key" in data, "Response should contain sidebar_api_key"
        assert data["sidebar_api_key"].startswith("zsk_"), f"Key should start with 'zsk_', got: {data['sidebar_api_key'][:10]}"
        print(f"✓ GET sidebar-key returned key: {data['sidebar_api_key'][:15]}...")

    def test_get_sidebar_key_requires_auth(self):
        """GET /api/admin/zendesk/sidebar-key requires authentication."""
        response = requests.get(f"{BASE_URL}/api/admin/zendesk/sidebar-key")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ GET sidebar-key requires authentication")

    def test_regenerate_sidebar_key_returns_new_key(self, auth_headers):
        """POST /api/admin/zendesk/sidebar-key/regenerate returns a new key."""
        # Get current key
        get_response = requests.get(
            f"{BASE_URL}/api/admin/zendesk/sidebar-key",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        old_key = get_response.json()["sidebar_api_key"]

        # Regenerate
        regen_response = requests.post(
            f"{BASE_URL}/api/admin/zendesk/sidebar-key/regenerate",
            headers=auth_headers
        )
        assert regen_response.status_code == 200, f"Expected 200, got {regen_response.status_code}: {regen_response.text}"
        data = regen_response.json()
        assert "sidebar_api_key" in data, "Response should contain sidebar_api_key"
        assert "message" in data, "Response should contain message"
        new_key = data["sidebar_api_key"]
        
        # Verify new key is different
        assert new_key != old_key, "Regenerated key should be different from old key"
        assert new_key.startswith("zsk_"), f"New key should start with 'zsk_', got: {new_key[:10]}"
        print(f"✓ Regenerate returned new key: {new_key[:15]}... (different from old)")

    def test_regenerate_sidebar_key_requires_auth(self):
        """POST /api/admin/zendesk/sidebar-key/regenerate requires authentication."""
        response = requests.post(f"{BASE_URL}/api/admin/zendesk/sidebar-key/regenerate")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ POST regenerate requires authentication")


class TestSidebarGenerateEndpoint:
    """Tests for the sidebar generate suggestion endpoint."""

    def test_generate_missing_sidebar_key_returns_401(self):
        """POST /api/zendesk/sidebar/generate without X-Sidebar-Key returns 401."""
        response = requests.post(
            f"{BASE_URL}/api/zendesk/sidebar/generate",
            json={"ticket_id": "12345"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "Missing sidebar API key" in data.get("detail", ""), f"Expected 'Missing sidebar API key' error, got: {data}"
        print("✓ Generate without X-Sidebar-Key returns 401 'Missing sidebar API key'")

    def test_generate_invalid_sidebar_key_returns_401(self):
        """POST /api/zendesk/sidebar/generate with invalid key returns 401."""
        response = requests.post(
            f"{BASE_URL}/api/zendesk/sidebar/generate",
            json={"ticket_id": "12345"},
            headers={
                "Content-Type": "application/json",
                "X-Sidebar-Key": "zsk_invalid_key_12345"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "Invalid sidebar API key" in data.get("detail", ""), f"Expected 'Invalid sidebar API key' error, got: {data}"
        print("✓ Generate with invalid X-Sidebar-Key returns 401 'Invalid sidebar API key'")

    def test_generate_valid_key_attempts_zendesk_fetch(self, auth_headers):
        """POST /api/zendesk/sidebar/generate with valid key attempts to fetch ticket from Zendesk."""
        # First get the valid sidebar key
        key_response = requests.get(
            f"{BASE_URL}/api/admin/zendesk/sidebar-key",
            headers=auth_headers
        )
        assert key_response.status_code == 200
        sidebar_key = key_response.json()["sidebar_api_key"]

        # Now try to generate with valid key
        response = requests.post(
            f"{BASE_URL}/api/zendesk/sidebar/generate",
            json={"ticket_id": "12345"},
            headers={
                "Content-Type": "application/json",
                "X-Sidebar-Key": sidebar_key
            }
        )
        
        # Expected: 401 with "authorization expired" since OAuth token is placeholder
        # This confirms the auth flow works - it authenticated via sidebar key
        # but failed when trying to fetch from Zendesk
        assert response.status_code == 401, f"Expected 401 (auth expired), got {response.status_code}: {response.text}"
        data = response.json()
        detail = data.get("detail", "").lower()
        assert "authorization expired" in detail or "expired" in detail or "reconnect" in detail, \
            f"Expected 'authorization expired' error (confirming auth flow works), got: {data}"
        print("✓ Generate with valid key authenticates but fails on Zendesk fetch (expected - OAuth token is placeholder)")

    def test_generate_requires_ticket_id(self, auth_headers):
        """POST /api/zendesk/sidebar/generate requires ticket_id in body."""
        key_response = requests.get(
            f"{BASE_URL}/api/admin/zendesk/sidebar-key",
            headers=auth_headers
        )
        assert key_response.status_code == 200
        sidebar_key = key_response.json()["sidebar_api_key"]

        # Try without ticket_id
        response = requests.post(
            f"{BASE_URL}/api/zendesk/sidebar/generate",
            json={},
            headers={
                "Content-Type": "application/json",
                "X-Sidebar-Key": sidebar_key
            }
        )
        # Should return 422 (validation error) or 400
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}: {response.text}"
        print("✓ Generate requires ticket_id in request body")


class TestSidebarAppZipDownload:
    """Tests for the sidebar app ZIP download endpoint."""

    def test_download_zip_returns_valid_zip(self, auth_headers):
        """GET /api/admin/zendesk/sidebar-app.zip returns a valid ZIP file."""
        response = requests.get(
            f"{BASE_URL}/api/admin/zendesk/sidebar-app.zip",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        assert "application/zip" in content_type or "application/octet-stream" in content_type, \
            f"Expected ZIP content type, got: {content_type}"
        
        # Check content disposition
        content_disp = response.headers.get("Content-Disposition", "")
        assert "bitbot-pro-zendesk-sidebar.zip" in content_disp, \
            f"Expected filename in Content-Disposition, got: {content_disp}"
        
        print("✓ ZIP download returns valid response with correct headers")

    def test_download_zip_contains_required_files(self, auth_headers):
        """GET /api/admin/zendesk/sidebar-app.zip contains manifest.json and assets."""
        response = requests.get(
            f"{BASE_URL}/api/admin/zendesk/sidebar-app.zip",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Parse ZIP
        zip_buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(zip_buffer, 'r') as zf:
            file_list = zf.namelist()
            
            # Check required files
            assert "manifest.json" in file_list, f"manifest.json not found in ZIP. Files: {file_list}"
            assert "assets/iframe.html" in file_list, f"assets/iframe.html not found in ZIP. Files: {file_list}"
            assert "assets/main.js" in file_list, f"assets/main.js not found in ZIP. Files: {file_list}"
            assert "assets/style.css" in file_list, f"assets/style.css not found in ZIP. Files: {file_list}"
            
            print(f"✓ ZIP contains all required files: {file_list}")

    def test_download_zip_manifest_structure(self, auth_headers):
        """GET /api/admin/zendesk/sidebar-app.zip manifest.json has correct structure."""
        response = requests.get(
            f"{BASE_URL}/api/admin/zendesk/sidebar-app.zip",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Parse ZIP and read manifest
        zip_buffer = io.BytesIO(response.content)
        with zipfile.ZipFile(zip_buffer, 'r') as zf:
            manifest_content = zf.read("manifest.json").decode("utf-8")
            manifest = json.loads(manifest_content)
            
            # Check frameworkVersion
            assert manifest.get("frameworkVersion") == "2.0", \
                f"Expected frameworkVersion '2.0', got: {manifest.get('frameworkVersion')}"
            
            # Check location
            assert "support" in manifest.get("location", {}), "manifest should have location.support"
            assert "ticket_sidebar" in manifest["location"]["support"], \
                "manifest should have location.support.ticket_sidebar"
            
            # Check parameters
            params = manifest.get("parameters", [])
            param_names = [p.get("name") for p in params]
            assert "bitbot_url" in param_names, f"manifest should have bitbot_url parameter. Got: {param_names}"
            assert "sidebar_api_key" in param_names, f"manifest should have sidebar_api_key parameter. Got: {param_names}"
            
            # Check sidebar_api_key is secure
            for p in params:
                if p.get("name") == "sidebar_api_key":
                    assert p.get("secure") == True, "sidebar_api_key parameter should be secure"
            
            print(f"✓ manifest.json has correct structure: frameworkVersion=2.0, location=ticket_sidebar, parameters={param_names}")

    def test_download_zip_requires_auth(self):
        """GET /api/admin/zendesk/sidebar-app.zip requires authentication."""
        response = requests.get(f"{BASE_URL}/api/admin/zendesk/sidebar-app.zip")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ ZIP download requires authentication")


class TestSidebarKeyWithoutZendeskConfig:
    """Tests for sidebar key endpoints when Zendesk is not connected."""

    def test_get_sidebar_key_without_zendesk_returns_400(self, auth_headers):
        """GET /api/admin/zendesk/sidebar-key returns 400 when no zendesk_config exists.
        
        Note: This test may pass or fail depending on whether there's a zendesk_config
        in the database. In the preview environment, there IS a seeded config, so this
        test verifies the endpoint works correctly with an existing config.
        """
        # First check if Zendesk is connected
        config_response = requests.get(
            f"{BASE_URL}/api/admin/zendesk-config",
            headers=auth_headers
        )
        assert config_response.status_code == 200
        config = config_response.json()
        
        if config.get("connected"):
            # Zendesk is connected, so sidebar-key should work
            response = requests.get(
                f"{BASE_URL}/api/admin/zendesk/sidebar-key",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Expected 200 when connected, got {response.status_code}"
            print("✓ GET sidebar-key returns 200 when Zendesk is connected (expected)")
        else:
            # Zendesk is not connected, should return 400
            response = requests.get(
                f"{BASE_URL}/api/admin/zendesk/sidebar-key",
                headers=auth_headers
            )
            assert response.status_code == 400, f"Expected 400 when not connected, got {response.status_code}"
            data = response.json()
            assert "Connect Zendesk first" in data.get("detail", ""), \
                f"Expected 'Connect Zendesk first' error, got: {data}"
            print("✓ GET sidebar-key returns 400 'Connect Zendesk first' when not connected")


class TestOldKeyInvalidAfterRegenerate:
    """Test that old sidebar key becomes invalid after regeneration."""

    def test_old_key_invalid_after_regenerate(self, auth_headers):
        """After regenerating, the old key should no longer work for generate calls."""
        # Get current key
        get_response = requests.get(
            f"{BASE_URL}/api/admin/zendesk/sidebar-key",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        old_key = get_response.json()["sidebar_api_key"]

        # Regenerate to get new key
        regen_response = requests.post(
            f"{BASE_URL}/api/admin/zendesk/sidebar-key/regenerate",
            headers=auth_headers
        )
        assert regen_response.status_code == 200
        new_key = regen_response.json()["sidebar_api_key"]
        assert new_key != old_key

        # Try to use old key - should fail with 401 "Invalid sidebar API key"
        response = requests.post(
            f"{BASE_URL}/api/zendesk/sidebar/generate",
            json={"ticket_id": "12345"},
            headers={
                "Content-Type": "application/json",
                "X-Sidebar-Key": old_key
            }
        )
        assert response.status_code == 401, f"Expected 401 with old key, got {response.status_code}: {response.text}"
        data = response.json()
        assert "Invalid sidebar API key" in data.get("detail", ""), \
            f"Expected 'Invalid sidebar API key' for old key, got: {data}"
        print("✓ Old key is invalid after regeneration")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
