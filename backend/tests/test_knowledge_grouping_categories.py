"""Public-API regression tests for grouped knowledge sources and categories."""

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
INSTANCE_ID = "5adabbd3-d178-4b6c-bffa-862e9806fd68"
RFC_URL = "https://www.rfc-editor.org/rfc/rfc8259.txt"
TEST_CATEGORY = "TEST_Grouped_KB_Category"


def _load_credentials() -> dict[str, str]:
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


@pytest.fixture(scope="module")
def api_client():
    """Authenticate through the public Preview URL and scope calls to the target instance."""
    assert BASE_URL, "REACT_APP_BACKEND_URL is missing"
    login = requests.post(
        f"{BASE_URL}/api/auth/login", json=_load_credentials(), timeout=30
    )
    assert login.status_code == 200, f"Login failed: {login.status_code} {login.text}"
    data = login.json()
    token = data.get("token")
    assert isinstance(token, str) and token
    assert data.get("user", {}).get("role") == "superadmin"

    session = requests.Session()
    session.headers.update(
        {
            "Authorization": f"Bearer {token}",
            "X-Instance-ID": INSTANCE_ID,
            "Content-Type": "application/json",
        }
    )
    return session


def _get_sources(api_client) -> list[dict]:
    response = api_client.get(f"{BASE_URL}/api/knowledge/sources", timeout=30)
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list)
    return data


@pytest.fixture(scope="module")
def created_group(api_client):
    """Create a real multi-chunk URL group, then remove it if a test leaves it behind."""
    response = api_client.post(
        f"{BASE_URL}/api/knowledge/sources/url",
        json={"url": RFC_URL, "title": "TEST_Grouped_JSON_RFC", "priority": 0},
        timeout=120,
    )
    assert response.status_code == 200, (
        f"RFC scrape failed: {response.status_code} {response.text[:1000]}"
    )
    data = response.json()
    assert isinstance(data.get("sources"), list), data
    assert data.get("chunks") == len(data["sources"])
    assert data["chunks"] > 1, f"Expected a multi-part scrape, got {data}"
    group_ids = {source.get("group_id") for source in data["sources"]}
    assert len(group_ids) == 1 and None not in group_ids
    group_id = next(iter(group_ids))
    source_ids = [source["id"] for source in data["sources"]]

    yield {
        "group_id": group_id,
        "source_ids": source_ids,
        "parts": len(source_ids),
        "total_chars": sum(len(source.get("content", "") or "") for source in data["sources"]),
    }

    sources = _get_sources(api_client)
    if any(item.get("group_id") == group_id for item in sources):
        api_client.delete(
            f"{BASE_URL}/api/knowledge/sources/group/{group_id}", timeout=30
        )


class TestGroupedKnowledgeCore:
    """Core grouped response, group CRUD, single category, and category-list behavior."""

    def test_01_seeded_sources_are_three_grouped_rows_with_metadata(self, api_client):
        sources = _get_sources(api_client)
        assert len(sources) == 3, (
            "Expected the three seeded rows before test data creation; "
            f"got {[(s.get('title'), s.get('total_parts')) for s in sources]}"
        )
        by_title = {source.get("title"): source for source in sources}
        assert set(by_title) == {
            "Lace FAQ",
            "Ableton Core Library",
            "How to reset password",
        }

        lace = by_title["Lace FAQ"]
        assert lace["type"] == "url"
        assert lace["total_parts"] == 10
        assert len(lace["parts"]) == 10
        assert len(set(lace["parts"])) == 10
        assert isinstance(lace.get("group_id"), str) and lace["group_id"]
        assert isinstance(lace.get("url"), str) and lace["url".strip()]
        assert isinstance(lace.get("created_at"), str) and lace["created_at"]
        assert isinstance(lace.get("total_chars"), int) and lace["total_chars"] > 0
        assert "content" not in lace

        ableton = by_title["Ableton Core Library"]
        faq = by_title["How to reset password"]
        assert ableton["type"] == "url" and ableton["total_parts"] == 1
        assert faq["type"] == "faq" and faq["total_parts"] == 1
        for source in (ableton, faq):
            assert len(source["parts"]) == 1
            assert isinstance(source.get("created_at"), str) and source["created_at"]
            assert isinstance(source.get("total_chars"), int) and source["total_chars"] > 0
            assert "content" not in source

    def test_10_created_url_is_one_grouped_row(self, api_client, created_group):
        matches = [
            source
            for source in _get_sources(api_client)
            if source.get("group_id") == created_group["group_id"]
        ]
        assert len(matches) == 1
        grouped = matches[0]
        assert grouped["title"] == "TEST_Grouped_JSON_RFC"
        assert grouped["total_parts"] == created_group["parts"]
        assert grouped["parts"] == created_group["source_ids"]
        assert grouped["total_chars"] == created_group["total_chars"]
        assert grouped["url"] == RFC_URL
        assert grouped["is_active"] is True

    def test_20_group_category_updates_group_and_categories(self, api_client, created_group):
        group_id = created_group["group_id"]
        response = api_client.patch(
            f"{BASE_URL}/api/knowledge/sources/group/{group_id}/category",
            json={"category": f"  {TEST_CATEGORY}  "},
            timeout=30,
        )
        assert response.status_code == 200, response.text
        assert response.json() == {"success": True, "category": TEST_CATEGORY}
        grouped = next(s for s in _get_sources(api_client) if s.get("group_id") == group_id)
        assert grouped["category"] == TEST_CATEGORY

        categories_response = api_client.get(
            f"{BASE_URL}/api/knowledge/categories", timeout=30
        )
        assert categories_response.status_code == 200, categories_response.text
        categories = categories_response.json()
        assert isinstance(categories, list)
        assert categories.count(TEST_CATEGORY) == 1
        assert all(isinstance(category, str) and category.strip() for category in categories)

    def test_30_group_toggle_changes_and_restores_active_state(self, api_client, created_group):
        group_id = created_group["group_id"]
        first = api_client.patch(
            f"{BASE_URL}/api/knowledge/sources/group/{group_id}/toggle", timeout=30
        )
        assert first.status_code == 200, first.text
        assert first.json() == {"is_active": False}
        grouped = next(s for s in _get_sources(api_client) if s.get("group_id") == group_id)
        assert grouped["is_active"] is False

        second = api_client.patch(
            f"{BASE_URL}/api/knowledge/sources/group/{group_id}/toggle", timeout=30
        )
        assert second.status_code == 200, second.text
        assert second.json() == {"is_active": True}
        grouped = next(s for s in _get_sources(api_client) if s.get("group_id") == group_id)
        assert grouped["is_active"] is True

    def test_40_group_priority_updates_group(self, api_client, created_group):
        group_id = created_group["group_id"]
        response = api_client.patch(
            f"{BASE_URL}/api/knowledge/sources/group/{group_id}/priority",
            json={"priority": 2},
            timeout=30,
        )
        assert response.status_code == 200, response.text
        assert response.json() == {"success": True, "priority": 2}
        grouped = next(s for s in _get_sources(api_client) if s.get("group_id") == group_id)
        assert grouped["priority"] == 2

    def test_50_single_source_category_updates_and_restores(self, api_client):
        source = next(
            item
            for item in _get_sources(api_client)
            if item.get("title") == "How to reset password"
        )
        source_id = source["parts"][0]
        original = source.get("category", "")
        try:
            response = api_client.patch(
                f"{BASE_URL}/api/knowledge/sources/{source_id}/category",
                json={"category": TEST_CATEGORY},
                timeout=30,
            )
            assert response.status_code == 200, response.text
            assert response.json() == {"success": True, "category": TEST_CATEGORY}
            updated = next(
                item
                for item in _get_sources(api_client)
                if item.get("title") == "How to reset password"
            )
            assert updated["category"] == TEST_CATEGORY
        finally:
            restore = api_client.patch(
                f"{BASE_URL}/api/knowledge/sources/{source_id}/category",
                json={"category": original},
                timeout=30,
            )
            assert restore.status_code == 200, restore.text

    def test_90_delete_group_removes_all_parts(self, api_client, created_group):
        group_id = created_group["group_id"]
        response = api_client.delete(
            f"{BASE_URL}/api/knowledge/sources/group/{group_id}", timeout=30
        )
        assert response.status_code == 200, response.text
        assert response.json() == {
            "success": True,
            "deleted": created_group["parts"],
        }
        remaining = _get_sources(api_client)
        assert not any(source.get("group_id") == group_id for source in remaining)
        remaining_part_ids = {
            part for source in remaining for part in source.get("parts", [])
        }
        assert not (set(created_group["source_ids"]) & remaining_part_ids)


class TestKnowledgeMutationValidation:
    """Error handling and input validation for knowledge mutation endpoints."""

    def test_nonexistent_group_category_returns_404(self, api_client):
        response = api_client.patch(
            f"{BASE_URL}/api/knowledge/sources/group/TEST_missing/category",
            json={"category": "TEST_missing"},
            timeout=30,
        )
        assert response.status_code == 404, response.text

    def test_nonexistent_group_priority_returns_404(self, api_client):
        response = api_client.patch(
            f"{BASE_URL}/api/knowledge/sources/group/TEST_missing/priority",
            json={"priority": 1},
            timeout=30,
        )
        assert response.status_code == 404, response.text

    def test_nonexistent_single_category_returns_404(self, api_client):
        response = api_client.patch(
            f"{BASE_URL}/api/knowledge/sources/TEST_missing/category",
            json={"category": "TEST_missing"},
            timeout=30,
        )
        assert response.status_code == 404, response.text

    def test_priority_rejects_out_of_range_values(self, api_client):
        source = next(
            item
            for item in _get_sources(api_client)
            if item.get("title") == "How to reset password"
        )
        source_id = source["parts"][0]
        original = source.get("priority", 0)
        try:
            response = api_client.patch(
                f"{BASE_URL}/api/knowledge/sources/{source_id}/priority",
                json={"priority": 99},
                timeout=30,
            )
            assert response.status_code == 422, response.text
        finally:
            restore = api_client.patch(
                f"{BASE_URL}/api/knowledge/sources/{source_id}/priority",
                json={"priority": original},
                timeout=30,
            )
            assert restore.status_code == 200, restore.text
