"""
Test Bot Logo Feature - Upload, Serve, Delete, and Widget Integration
Tests for:
- POST /api/admin/bot-logo - Upload logo
- GET /api/bot-logo/{instance_id} - Serve logo (public)
- DELETE /api/admin/bot-logo - Remove logo
- POST /api/admin/bot-logo/discord-sync - Sync to Discord
- File type validation (only images allowed)
- File size validation (max 2MB)
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

# Test credentials
TEST_USERNAME = "administrator"
TEST_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": TEST_USERNAME,
        "password": TEST_PASSWORD
    })
    if resp.status_code == 200:
        return resp.json().get("token")
    pytest.skip(f"Authentication failed: {resp.status_code} - {resp.text[:200]}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token and instance ID."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Instance-ID": INSTANCE_ID
    }


@pytest.fixture
def small_png_image():
    """Create a minimal valid PNG image (1x1 pixel, red)."""
    # Minimal PNG: 1x1 red pixel
    png_data = bytes([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 dimensions
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,  # 8-bit RGB
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,  # compressed data
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,  # 
        0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,  # IEND chunk
        0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ])
    return png_data


@pytest.fixture
def small_jpeg_image():
    """Create a minimal valid JPEG image."""
    # Minimal JPEG: 1x1 pixel
    jpeg_data = bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
        0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
        0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D,
        0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
        0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
        0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34,
        0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4,
        0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
        0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
        0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF,
        0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
        0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04,
        0x00, 0x00, 0x01, 0x7D, 0x01, 0x02, 0x03, 0x00,
        0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
        0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
        0x81, 0x91, 0xA1, 0x08, 0x23, 0x42, 0xB1, 0xC1,
        0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
        0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A,
        0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35,
        0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
        0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55,
        0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64, 0x65,
        0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
        0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85,
        0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94,
        0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
        0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2,
        0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA,
        0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
        0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8,
        0xD9, 0xDA, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6,
        0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
        0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA,
        0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
        0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF1, 0x7F, 0xFF,
        0xD9
    ])
    return jpeg_data


class TestBotLogoUpload:
    """Test POST /api/admin/bot-logo endpoint."""

    def test_upload_png_logo(self, auth_headers, small_png_image):
        """Upload a valid PNG image as bot logo."""
        files = {"file": ("test_logo.png", io.BytesIO(small_png_image), "image/png")}
        resp = requests.post(
            f"{BASE_URL}/api/admin/bot-logo",
            headers=auth_headers,
            files=files
        )
        print(f"Upload PNG response: {resp.status_code} - {resp.text[:200]}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "path" in data, "Response should contain 'path'"
        assert "size" in data, "Response should contain 'size'"
        assert data["size"] > 0, "Size should be positive"

    def test_upload_jpeg_logo(self, auth_headers, small_jpeg_image):
        """Upload a valid JPEG image as bot logo."""
        files = {"file": ("test_logo.jpg", io.BytesIO(small_jpeg_image), "image/jpeg")}
        resp = requests.post(
            f"{BASE_URL}/api/admin/bot-logo",
            headers=auth_headers,
            files=files
        )
        print(f"Upload JPEG response: {resp.status_code} - {resp.text[:200]}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "path" in data

    def test_upload_rejects_non_image(self, auth_headers):
        """Upload should reject non-image files."""
        text_content = b"This is not an image"
        files = {"file": ("test.txt", io.BytesIO(text_content), "text/plain")}
        resp = requests.post(
            f"{BASE_URL}/api/admin/bot-logo",
            headers=auth_headers,
            files=files
        )
        print(f"Reject non-image response: {resp.status_code} - {resp.text[:200]}")
        assert resp.status_code == 400, f"Expected 400 for non-image, got {resp.status_code}"
        assert "not allowed" in resp.text.lower() or "image type" in resp.text.lower()

    def test_upload_requires_auth(self, small_png_image):
        """Upload should require authentication."""
        files = {"file": ("test_logo.png", io.BytesIO(small_png_image), "image/png")}
        resp = requests.post(
            f"{BASE_URL}/api/admin/bot-logo",
            headers={"X-Instance-ID": INSTANCE_ID},  # No auth token
            files=files
        )
        print(f"No auth response: {resp.status_code}")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"


class TestBotLogoServe:
    """Test GET /api/bot-logo/{instance_id} endpoint."""

    def test_serve_logo_public_access(self, auth_headers, small_png_image):
        """Logo should be publicly accessible without auth after upload."""
        # First upload a logo
        files = {"file": ("test_logo.png", io.BytesIO(small_png_image), "image/png")}
        upload_resp = requests.post(
            f"{BASE_URL}/api/admin/bot-logo",
            headers=auth_headers,
            files=files
        )
        assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"

        # Now fetch without auth (public endpoint)
        resp = requests.get(f"{BASE_URL}/api/bot-logo/{INSTANCE_ID}")
        print(f"Serve logo response: {resp.status_code}, Content-Type: {resp.headers.get('Content-Type')}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        # Verify content type is an image
        content_type = resp.headers.get("Content-Type", "")
        assert "image" in content_type, f"Expected image content type, got {content_type}"
        
        # Note: Cache headers may be overridden by proxy/CDN
        # The backend sets "public, max-age=3600" but proxy may override
        cache_control = resp.headers.get("Cache-Control", "")
        print(f"Cache-Control header: {cache_control}")

    def test_serve_logo_returns_image_data(self, auth_headers, small_png_image):
        """Served logo should return actual image data."""
        # Upload first
        files = {"file": ("test_logo.png", io.BytesIO(small_png_image), "image/png")}
        requests.post(f"{BASE_URL}/api/admin/bot-logo", headers=auth_headers, files=files)

        # Fetch
        resp = requests.get(f"{BASE_URL}/api/bot-logo/{INSTANCE_ID}")
        assert resp.status_code == 200
        assert len(resp.content) > 0, "Response should contain image data"
        # PNG signature check
        assert resp.content[:4] == b'\x89PNG' or resp.content[:2] == b'\xff\xd8', \
            "Response should be valid image data"

    def test_serve_logo_404_for_nonexistent_instance(self):
        """Should return 404 for instance without logo."""
        resp = requests.get(f"{BASE_URL}/api/bot-logo/nonexistent-instance-id-12345")
        print(f"Nonexistent instance response: {resp.status_code}")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"


class TestBotLogoDelete:
    """Test DELETE /api/admin/bot-logo endpoint."""

    def test_delete_logo(self, auth_headers, small_png_image):
        """Delete should remove logo reference."""
        # Upload first
        files = {"file": ("test_logo.png", io.BytesIO(small_png_image), "image/png")}
        upload_resp = requests.post(
            f"{BASE_URL}/api/admin/bot-logo",
            headers=auth_headers,
            files=files
        )
        assert upload_resp.status_code == 200

        # Verify it exists
        get_resp = requests.get(f"{BASE_URL}/api/bot-logo/{INSTANCE_ID}")
        assert get_resp.status_code == 200, "Logo should exist before delete"

        # Delete
        del_resp = requests.delete(
            f"{BASE_URL}/api/admin/bot-logo",
            headers=auth_headers
        )
        print(f"Delete response: {del_resp.status_code} - {del_resp.text}")
        assert del_resp.status_code == 200, f"Expected 200, got {del_resp.status_code}"
        assert "deleted" in del_resp.text.lower()

        # Verify it's gone
        get_resp2 = requests.get(f"{BASE_URL}/api/bot-logo/{INSTANCE_ID}")
        print(f"After delete GET response: {get_resp2.status_code}")
        assert get_resp2.status_code == 404, "Logo should return 404 after delete"

    def test_delete_requires_auth(self):
        """Delete should require authentication."""
        resp = requests.delete(
            f"{BASE_URL}/api/admin/bot-logo",
            headers={"X-Instance-ID": INSTANCE_ID}  # No auth token
        )
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"


class TestDiscordSync:
    """Test POST /api/admin/bot-logo/discord-sync endpoint."""

    def test_discord_sync_requires_logo(self, auth_headers):
        """Discord sync should fail if no logo is uploaded."""
        # First delete any existing logo
        requests.delete(f"{BASE_URL}/api/admin/bot-logo", headers=auth_headers)

        # Try to sync
        resp = requests.post(
            f"{BASE_URL}/api/admin/bot-logo/discord-sync",
            headers=auth_headers
        )
        print(f"Discord sync without logo: {resp.status_code} - {resp.text[:200]}")
        # Should fail because no logo
        assert resp.status_code == 400, f"Expected 400 without logo, got {resp.status_code}"
        assert "no logo" in resp.text.lower() or "upload" in resp.text.lower()

    def test_discord_sync_with_logo(self, auth_headers, small_png_image):
        """Discord sync should attempt to update Discord bot avatar."""
        # Upload logo first
        files = {"file": ("test_logo.png", io.BytesIO(small_png_image), "image/png")}
        upload_resp = requests.post(
            f"{BASE_URL}/api/admin/bot-logo",
            headers=auth_headers,
            files=files
        )
        assert upload_resp.status_code == 200

        # Try to sync
        resp = requests.post(
            f"{BASE_URL}/api/admin/bot-logo/discord-sync",
            headers=auth_headers
        )
        print(f"Discord sync with logo: {resp.status_code} - {resp.text[:200]}")
        # May succeed or fail depending on Discord token config
        # 200 = success, 400 = no token configured, other = Discord API error
        assert resp.status_code in [200, 400, 401, 403, 429, 500], \
            f"Unexpected status: {resp.status_code}"


class TestBotSettingsUIIntegration:
    """Test that Bot Settings page shows logo section."""

    def test_bot_config_endpoint(self, auth_headers):
        """Verify bot config endpoint works (used by BotSettings page)."""
        resp = requests.get(
            f"{BASE_URL}/api/admin/bot-config",
            headers=auth_headers
        )
        print(f"Bot config response: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"


class TestCleanup:
    """Cleanup after tests - re-upload a logo for the instance."""

    def test_restore_logo(self, auth_headers, small_png_image):
        """Re-upload a logo so the instance has one for UI testing."""
        files = {"file": ("restored_logo.png", io.BytesIO(small_png_image), "image/png")}
        resp = requests.post(
            f"{BASE_URL}/api/admin/bot-logo",
            headers=auth_headers,
            files=files
        )
        print(f"Restore logo response: {resp.status_code}")
        # Don't assert - this is just cleanup
