"""Regression tests for URL scraping fallbacks and normal URL extraction.

Covers the Zendesk Help Center fallback for Cloudflare-protected /hc/ article
URLs and verifies that ordinary HTML scraping still persists extracted content.
"""

import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

FRONTEND_ENV = dotenv_values("/app/frontend/.env")
BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or FRONTEND_ENV.get("REACT_APP_BACKEND_URL")
    or ""
).rstrip("/")
INSTANCE_ID = "810f50a0-54f8-4cba-9de4-cdb90a4b0e10"
ABLETON_URL = "https://help.ableton.com/hc/en-us/articles/360000776490-The-Core-Library"
NORMAL_URL = "https://httpbin.org/html"


def _load_credentials() -> dict[str, str]:
    """Read the admin account under test from the shared credentials file."""
    path = Path("/app/memory/test_credentials.md")
    if not path.exists():
        pytest.skip("Missing /app/memory/test_credentials.md")
    content = path.read_text(encoding="utf-8")
    username = re.search(r"(?im)^- Username:\s*([^\s]+)", content)
    password = re.search(r"(?im)^- Password:\s*([^\s]+)", content)
    if not username or not password:
        pytest.skip("Admin username/password missing from test_credentials.md")
    return {
        "email_or_username": username.group(1),
        "password": password.group(1),
    }


def _sources_from_response(data: dict) -> list[dict]:
    """Normalize single-source and chunked scraper response shapes."""
    if "sources" in data:
        assert isinstance(data["sources"], list)
        assert data.get("chunks") == len(data["sources"])
        assert isinstance(data.get("total_chars"), int)
        return data["sources"]
    return [data]


@pytest.fixture(scope="module")
def api_client():
    """Authenticated client scoped to the requested test bot instance."""
    assert BASE_URL, "REACT_APP_BACKEND_URL is missing"
    login = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=_load_credentials(),
        timeout=30,
    )
    assert login.status_code == 200, f"Login failed: {login.status_code} {login.text}"
    login_data = login.json()
    token = login_data.get("token") or login_data.get("access_token")
    assert isinstance(token, str) and token, f"Login response omitted token: {login_data}"

    session = requests.Session()
    session.headers.update(
        {
            "Authorization": f"Bearer {token}",
            "X-Instance-ID": INSTANCE_ID,
            "Content-Type": "application/json",
        }
    )
    return session


@pytest.fixture(scope="module")
def created_source_ids(api_client):
    """Track every scraper-created source, then delete and verify cleanup."""
    source_ids: list[str] = []
    yield source_ids

    cleanup_failures = []
    for source_id in source_ids:
        response = api_client.delete(
            f"{BASE_URL}/api/knowledge/sources/{source_id}", timeout=30
        )
        if response.status_code != 200 or response.json().get("success") is not True:
            cleanup_failures.append(
                f"DELETE {source_id}: {response.status_code} {response.text}"
            )

    remaining_response = api_client.get(
        f"{BASE_URL}/api/knowledge/sources", timeout=30
    )
    if remaining_response.status_code != 200:
        cleanup_failures.append(
            f"GET after cleanup: {remaining_response.status_code} {remaining_response.text}"
        )
    else:
        remaining_ids = {item.get("id") for item in remaining_response.json()}
        leaked = [source_id for source_id in source_ids if source_id in remaining_ids]
        if leaked:
            cleanup_failures.append(f"Sources still persisted after DELETE: {leaked}")

    assert not cleanup_failures, "; ".join(cleanup_failures)


@pytest.fixture(scope="module")
def ableton_sources(api_client, created_source_ids):
    """Scrape the Cloudflare-protected Ableton Zendesk article once."""
    response = api_client.post(
        f"{BASE_URL}/api/knowledge/sources/url",
        json={"url": ABLETON_URL, "priority": 1},
        timeout=90,
    )
    assert response.status_code == 200, (
        f"Ableton scrape failed: {response.status_code} {response.text}"
    )
    data = response.json()
    assert isinstance(data, dict), f"Expected object response, got {type(data)}"
    sources = _sources_from_response(data)
    assert sources, f"Scraper returned no sources: {data}"
    for source in sources:
        source_id = source.get("id")
        assert isinstance(source_id, str) and source_id
        created_source_ids.append(source_id)
    return sources


@pytest.fixture(scope="module")
def normal_sources(api_client, created_source_ids):
    """Scrape an ordinary, non-protected HTML page once."""
    response = api_client.post(
        f"{BASE_URL}/api/knowledge/sources/url",
        json={"url": NORMAL_URL, "title": "TEST_httpbin_HTML", "priority": 2},
        timeout=90,
    )
    assert response.status_code == 200, (
        f"Normal URL scrape failed: {response.status_code} {response.text}"
    )
    data = response.json()
    assert isinstance(data, dict), f"Expected object response, got {type(data)}"
    sources = _sources_from_response(data)
    assert sources, f"Scraper returned no sources: {data}"
    for source in sources:
        source_id = source.get("id")
        assert isinstance(source_id, str) and source_id
        created_source_ids.append(source_id)
    return sources


class TestZendeskFallback:
    """Cloudflare 403 regression coverage for the Ableton Zendesk article."""

    def test_ableton_scrape_returns_expected_metadata(self, ableton_sources):
        assert all(source["type"] == "url" for source in ableton_sources)
        assert all(source["url"] == ABLETON_URL for source in ableton_sources)
        assert all(source["instance_id"] == INSTANCE_ID for source in ableton_sources)
        assert all(source["priority"] == 1 for source in ableton_sources)
        assert all(source["is_active"] is True for source in ableton_sources)
        combined_title = " ".join(source.get("title", "") for source in ableton_sources)
        assert "Core Library" in combined_title

    def test_ableton_content_is_relevant_and_complete(self, ableton_sources):
        content = "\n".join(source.get("content", "") for source in ableton_sources)
        lower = content.lower()
        assert len(content) > 500, f"Extracted content unexpectedly short: {len(content)}"
        assert "core library" in lower
        assert "live versions" in lower and "all" in lower
        assert "windows" in lower and "programdata" in lower
        assert "mac" in lower and "app-resources" in lower
        assert "presets" in lower and "drum kits" in lower and "samples" in lower
        assert "cannot be changed or moved" in lower

    def test_ableton_sources_are_persisted(self, api_client, ableton_sources):
        response = api_client.get(f"{BASE_URL}/api/knowledge/sources", timeout=30)
        assert response.status_code == 200, response.text
        persisted = {item["id"]: item for item in response.json()}
        for source in ableton_sources:
            assert source["id"] in persisted
            stored = persisted[source["id"]]
            assert stored["content"] == source["content"]
            assert stored["url"] == ABLETON_URL


class TestNormalURLRegression:
    """Regression coverage for the standard BeautifulSoup extraction path."""

    def test_normal_html_scrape_returns_expected_content(self, normal_sources):
        content = "\n".join(source.get("content", "") for source in normal_sources)
        assert len(content) > 100
        assert "Herman Melville" in content
        assert "Moby-Dick" in content
        assert all(source["title"] == "TEST_httpbin_HTML" for source in normal_sources)
        assert all(source["url"] == NORMAL_URL for source in normal_sources)
        assert all(source["priority"] == 2 for source in normal_sources)

    def test_normal_url_source_is_persisted(self, api_client, normal_sources):
        response = api_client.get(f"{BASE_URL}/api/knowledge/sources", timeout=30)
        assert response.status_code == 200, response.text
        persisted = {item["id"]: item for item in response.json()}
        for source in normal_sources:
            assert source["id"] in persisted
            assert persisted[source["id"]]["content"] == source["content"]
