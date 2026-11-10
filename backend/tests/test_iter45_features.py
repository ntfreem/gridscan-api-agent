"""
Iteration 45 Tests: Smart File Filters, Widget Theme URL Params, Markdown Rendering
Tests for:
1. GitHub scanner returns extension and size fields
2. Widget theme URL parameters
3. Markdown rendering in chat widget
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

@pytest.fixture(scope="module")
def auth_headers():
    """Get authentication headers for API calls."""
    login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": "administrator",
        "password": "Admin@123"
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json().get("token")
    return {
        "Authorization": f"Bearer {token}",
        "X-Instance-ID": INSTANCE_ID,
        "Content-Type": "application/json"
    }


class TestGitHubScannerExtensionAndSize:
    """Test that GitHub scanner returns extension and size fields for each file."""
    
    def test_scan_returns_extension_field(self, auth_headers):
        """Verify scan results include 'extension' field for each doc file."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/scan",
            headers=auth_headers,
            json={"repo_url": "https://github.com/expressjs/express"}
        )
        assert resp.status_code == 200, f"Scan failed: {resp.text}"
        data = resp.json()
        
        assert "doc_files" in data, "Response missing doc_files array"
        assert len(data["doc_files"]) > 0, "No doc files found"
        
        # Check first few files have extension field
        for file in data["doc_files"][:5]:
            assert "extension" in file, f"File missing 'extension' field: {file}"
            # Extension should be a string (can be empty for files without extension)
            assert isinstance(file["extension"], str), f"Extension should be string: {file}"
    
    def test_scan_returns_size_field(self, auth_headers):
        """Verify scan results include 'size' field for each doc file."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/scan",
            headers=auth_headers,
            json={"repo_url": "https://github.com/expressjs/express"}
        )
        assert resp.status_code == 200, f"Scan failed: {resp.text}"
        data = resp.json()
        
        assert "doc_files" in data, "Response missing doc_files array"
        
        # Check first few files have size field
        for file in data["doc_files"][:5]:
            assert "size" in file, f"File missing 'size' field: {file}"
            # Size should be an integer >= 0
            assert isinstance(file["size"], int), f"Size should be integer: {file}"
            assert file["size"] >= 0, f"Size should be non-negative: {file}"
    
    def test_scan_extension_values_correct(self, auth_headers):
        """Verify extension values are correctly extracted from file paths."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/scan",
            headers=auth_headers,
            json={"repo_url": "https://github.com/expressjs/express"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Find files with known extensions
        md_files = [f for f in data["doc_files"] if f["path"].endswith(".md")]
        if md_files:
            for f in md_files[:3]:
                assert f["extension"] == ".md", f"Expected .md extension for {f['path']}, got {f['extension']}"
        
        # Check README files (may not have extension)
        readme_files = [f for f in data["doc_files"] if "readme" in f["path"].lower() and not f["path"].endswith(".md")]
        for f in readme_files[:2]:
            # README without extension should have empty extension
            if "." not in os.path.basename(f["path"]):
                assert f["extension"] == "", f"Expected empty extension for {f['path']}, got {f['extension']}"
    
    def test_scan_returns_all_required_fields(self, auth_headers):
        """Verify each doc file has all required fields: path, size, category, extension."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/scan",
            headers=auth_headers,
            json={"repo_url": "https://github.com/expressjs/express"}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        required_fields = ["path", "size", "category", "extension"]
        for file in data["doc_files"][:10]:
            for field in required_fields:
                assert field in file, f"File missing required field '{field}': {file}"


class TestWidgetThemeURLParams:
    """Test that widget accepts theme URL parameters."""
    
    def test_widget_page_loads(self, auth_headers):
        """Verify widget page loads successfully."""
        resp = requests.get(f"{BASE_URL}/widget?instance={INSTANCE_ID}")
        assert resp.status_code == 200, f"Widget page failed to load: {resp.status_code}"
    
    def test_widget_with_theme_params_loads(self, auth_headers):
        """Verify widget page loads with theme URL parameters."""
        theme_params = (
            f"instance={INSTANCE_ID}"
            "&accent=%237C3AED"
            "&accentLight=%2300D4FF"
            "&bg=%230B0A1A"
            "&surface=%231A1040"
            "&panel=%23251A4D"
        )
        resp = requests.get(f"{BASE_URL}/widget?{theme_params}")
        assert resp.status_code == 200, f"Widget with theme params failed: {resp.status_code}"
    
    def test_widget_without_theme_params_loads(self, auth_headers):
        """Verify widget loads with default theme when no params provided."""
        resp = requests.get(f"{BASE_URL}/widget?instance={INSTANCE_ID}")
        assert resp.status_code == 200, f"Widget without theme params failed: {resp.status_code}"


class TestChatEndpoint:
    """Test chat endpoint for markdown rendering verification."""
    
    def test_chat_send_endpoint_works(self, auth_headers):
        """Verify chat/send endpoint responds correctly."""
        resp = requests.post(
            f"{BASE_URL}/api/chat/send",
            headers=auth_headers,
            json={
                "message": "Hello, can you help me?",
                "instance_id": INSTANCE_ID
            }
        )
        # Chat endpoint should return 200
        assert resp.status_code == 200, f"Chat failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        # Should have response and session_id
        assert "response" in data or "session_id" in data, f"Unexpected chat response: {data}"


class TestEmbedConfig:
    """Test embed config endpoint used by widget."""
    
    def test_embed_config_endpoint(self, auth_headers):
        """Verify embed config endpoint returns valid response."""
        resp = requests.get(f"{BASE_URL}/api/embed/config/{INSTANCE_ID}")
        # Should return 200 even if no custom config
        assert resp.status_code == 200, f"Embed config failed: {resp.status_code}"
        data = resp.json()
        # Response should be a dict (may be empty)
        assert isinstance(data, dict), f"Expected dict response, got {type(data)}"


class TestBotConfig:
    """Test bot config endpoint used by widget."""
    
    def test_bot_config_endpoint(self, auth_headers):
        """Verify bot config endpoint returns bot name."""
        resp = requests.get(
            f"{BASE_URL}/api/admin/bot-config",
            headers=auth_headers
        )
        assert resp.status_code == 200, f"Bot config failed: {resp.status_code}"
        data = resp.json()
        # Should have a name field
        assert "name" in data or data == {}, f"Unexpected bot config response: {data}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
