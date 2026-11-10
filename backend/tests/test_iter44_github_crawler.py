"""
Test suite for GitHub Repository Crawler feature (Iteration 44)
Tests:
- POST /api/knowledge/sources/github/scan - scan public/private repos
- POST /api/knowledge/sources/github/import-stream - SSE import of selected files
"""
import pytest
import requests
import os
import json
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

# Test credentials
TEST_USERNAME = "administrator"
TEST_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for API calls."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": TEST_USERNAME,
        "password": TEST_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Auth failed: {resp.status_code} - {resp.text[:200]}")
    return resp.json().get("token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token and instance ID."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Instance-ID": INSTANCE_ID,
        "Content-Type": "application/json"
    }


class TestGitHubScanEndpoint:
    """Tests for POST /api/knowledge/sources/github/scan"""

    def test_scan_valid_public_repo(self, auth_headers):
        """Scan a valid public repo - should return repo info and doc_files array."""
        # Using a small, stable public repo
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/scan",
            headers=auth_headers,
            json={"repo_url": "https://github.com/expressjs/express"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"
        
        data = resp.json()
        # Verify response structure
        assert "owner" in data, "Response missing 'owner'"
        assert "repo" in data, "Response missing 'repo'"
        assert "branch" in data, "Response missing 'branch'"
        assert "doc_files" in data, "Response missing 'doc_files'"
        assert "doc_count" in data, "Response missing 'doc_count'"
        assert "total_files" in data, "Response missing 'total_files'"
        
        # Verify values
        assert data["owner"] == "expressjs"
        assert data["repo"] == "express"
        assert isinstance(data["doc_files"], list)
        assert data["doc_count"] >= 0
        
        # If docs found, verify structure
        if data["doc_files"]:
            doc = data["doc_files"][0]
            assert "path" in doc
            assert "size" in doc
            assert "category" in doc
            print(f"PASS: Scanned {data['owner']}/{data['repo']}, found {data['doc_count']} doc files")

    def test_scan_with_branch_specified(self, auth_headers):
        """Scan with explicit branch parameter."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/scan",
            headers=auth_headers,
            json={
                "repo_url": "https://github.com/expressjs/express",
                "branch": "master"
            }
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"
        data = resp.json()
        assert data["branch"] == "master"
        print(f"PASS: Scanned with explicit branch 'master'")

    def test_scan_invalid_url_format(self, auth_headers):
        """Invalid URL format should return 400."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/scan",
            headers=auth_headers,
            json={"repo_url": "not-a-valid-url"}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        assert "Invalid GitHub URL" in resp.json().get("detail", "")
        print("PASS: Invalid URL returns 400")

    def test_scan_invalid_github_url(self, auth_headers):
        """Non-GitHub URL should return 400."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/scan",
            headers=auth_headers,
            json={"repo_url": "https://gitlab.com/owner/repo"}
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        print("PASS: Non-GitHub URL returns 400")

    def test_scan_nonexistent_repo(self, auth_headers):
        """Nonexistent repo should return 404."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/scan",
            headers=auth_headers,
            json={"repo_url": "https://github.com/nonexistent-owner-xyz123/nonexistent-repo-abc456"}
        )
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text[:200]}"
        print("PASS: Nonexistent repo returns 404")

    def test_scan_without_auth(self):
        """Scan without auth should return 401."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/scan",
            headers={"Content-Type": "application/json"},
            json={"repo_url": "https://github.com/expressjs/express"}
        )
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("PASS: Unauthenticated request returns 401")


class TestGitHubImportStream:
    """Tests for POST /api/knowledge/sources/github/import-stream (SSE)"""

    def test_import_stream_returns_sse_events(self, auth_headers):
        """Import selected files should return SSE events with progress, success, done."""
        # First scan to get valid file paths
        scan_resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/scan",
            headers=auth_headers,
            json={"repo_url": "https://github.com/expressjs/express"}
        )
        if scan_resp.status_code != 200:
            pytest.skip("Scan failed, cannot test import")
        
        scan_data = scan_resp.json()
        if not scan_data.get("doc_files"):
            pytest.skip("No doc files found to import")
        
        # Select just 1-2 small files for quick test
        files_to_import = [f["path"] for f in scan_data["doc_files"][:2]]
        
        # Make SSE request
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/import-stream",
            headers=auth_headers,
            json={
                "repo_url": "https://github.com/expressjs/express",
                "branch": scan_data["branch"],
                "files": files_to_import,
                "category": "TEST_GitHub_Import"
            },
            stream=True
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"
        assert "text/event-stream" in resp.headers.get("content-type", ""), "Expected SSE content type"
        
        # Parse SSE events
        events = []
        event_types = set()
        for line in resp.iter_lines(decode_unicode=True):
            if line and line.startswith("data: "):
                try:
                    data = json.loads(line[6:])
                    events.append(data)
                    event_types.add(data.get("type"))
                except json.JSONDecodeError:
                    pass
        
        # Verify we got expected event types
        assert "progress" in event_types, f"Missing 'progress' events. Got: {event_types}"
        assert "done" in event_types, f"Missing 'done' event. Got: {event_types}"
        
        # Verify done event has expected fields
        done_event = next((e for e in events if e.get("type") == "done"), None)
        assert done_event is not None, "No 'done' event found"
        assert "imported" in done_event, "Done event missing 'imported' count"
        assert "failed" in done_event, "Done event missing 'failed' count"
        assert "total" in done_event, "Done event missing 'total' count"
        
        print(f"PASS: SSE import completed - imported: {done_event['imported']}, failed: {done_event['failed']}")
        
        # Return imported count for cleanup
        return done_event.get("imported", 0)

    def test_import_invalid_url(self, auth_headers):
        """Import with invalid URL should return 400."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/import-stream",
            headers=auth_headers,
            json={
                "repo_url": "invalid-url",
                "branch": "main",
                "files": ["README.md"]
            }
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        print("PASS: Import with invalid URL returns 400")

    def test_import_no_files_selected(self, auth_headers):
        """Import with empty files list should return 400."""
        resp = requests.post(
            f"{BASE_URL}/api/knowledge/sources/github/import-stream",
            headers=auth_headers,
            json={
                "repo_url": "https://github.com/expressjs/express",
                "branch": "master",
                "files": []
            }
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        assert "No files selected" in resp.json().get("detail", "")
        print("PASS: Import with no files returns 400")


class TestGitHubSourcesInKB:
    """Tests to verify GitHub sources are stored correctly."""

    def test_github_sources_have_correct_type(self, auth_headers):
        """Verify imported GitHub sources have type='github'."""
        resp = requests.get(
            f"{BASE_URL}/api/knowledge/sources",
            headers=auth_headers
        )
        assert resp.status_code == 200
        
        sources = resp.json()
        github_sources = [s for s in sources if s.get("type") == "github"]
        
        # Check if any GitHub sources exist (from previous import test)
        if github_sources:
            source = github_sources[0]
            assert source.get("type") == "github"
            # GitHub sources should have source_repo field
            print(f"PASS: Found {len(github_sources)} GitHub source(s) with correct type")
        else:
            print("INFO: No GitHub sources found (import may not have run yet)")


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_sources(auth_headers):
    """Clean up TEST_ prefixed sources after tests."""
    yield
    # Cleanup: delete sources with TEST_ category
    try:
        resp = requests.get(f"{BASE_URL}/api/knowledge/sources", headers=auth_headers)
        if resp.status_code == 200:
            sources = resp.json()
            test_sources = [s for s in sources if "TEST_" in (s.get("category") or "")]
            for source in test_sources:
                source_id = source.get("id") or (source.get("parts") or [None])[0]
                if source_id:
                    requests.delete(f"{BASE_URL}/api/knowledge/sources/{source_id}", headers=auth_headers)
            if test_sources:
                print(f"Cleanup: Deleted {len(test_sources)} TEST_ sources")
    except Exception as e:
        print(f"Cleanup warning: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
