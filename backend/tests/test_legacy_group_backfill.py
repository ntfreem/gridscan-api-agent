"""Regression tests for legacy Knowledge Base group-id backfill and categories."""

import os
import re
import uuid
from pathlib import Path
from urllib.parse import quote

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

FRONTEND_ENV = dotenv_values("/app/frontend/.env")
BACKEND_ENV = dotenv_values("/app/backend/.env")
BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or FRONTEND_ENV.get("REACT_APP_BACKEND_URL")
    or ""
).rstrip("/")
INSTANCE_ID = "5adabbd3-d178-4b6c-bffa-862e9806fd68"
LEGACY_URL = "https://example.com/TEST_legacy/path/with/slashes"
LEGACY_TITLE = "TEST_Legacy_Backfill"
LEGACY_CATEGORY = "TEST_Legacy_Backfill_Category"
SINGLE_CATEGORY = "TEST_Single_Category_Regression"
PROPER_GROUP_CATEGORY = "TEST_Proper_Group_Category_Regression"


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


@pytest.fixture(scope="module")
def mongo_collection():
    """Use the configured Preview MongoDB database for direct legacy seed setup."""
    mongo_url = os.environ.get("MONGO_URL") or BACKEND_ENV.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME") or BACKEND_ENV.get("DB_NAME")
    assert mongo_url and db_name, "MONGO_URL/DB_NAME are missing"
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=15000)
    client.admin.command("ping")
    yield client[db_name].knowledge_sources
    client.close()


@pytest.fixture(scope="module")
def legacy_seed(mongo_collection):
    """Insert three URL chunks without group_id and always remove them after testing."""
    ids = [f"TEST_legacy_{uuid.uuid4()}" for _ in range(3)]
    mongo_collection.delete_many(
        {"instance_id": INSTANCE_ID, "url": LEGACY_URL, "title": {"$regex": f"^{LEGACY_TITLE}"}}
    )
    docs = [
        {
            "id": source_id,
            "instance_id": INSTANCE_ID,
            "type": "url",
            "url": LEGACY_URL,
            "title": f"{LEGACY_TITLE} (part {index}/3)",
            "content": f"TEST legacy content part {index}",
            "priority": 0,
            "category": "",
            "is_active": True,
            "created_at": f"2026-07-01T00:00:0{index}+00:00",
        }
        for index, source_id in enumerate(ids, start=1)
    ]
    result = mongo_collection.insert_many(docs)
    assert len(result.inserted_ids) == 3
    assert mongo_collection.count_documents({"id": {"$in": ids}, "group_id": {"$exists": False}}) == 3
    state = {"ids": ids, "group_id": None}
    yield state
    cleanup = mongo_collection.delete_many({"id": {"$in": ids}, "instance_id": INSTANCE_ID})
    assert cleanup.deleted_count == 3
    assert mongo_collection.count_documents({"id": {"$in": ids}}) == 0


def _get_sources(api_client) -> list[dict]:
    response = api_client.get(f"{BASE_URL}/api/knowledge/sources", timeout=30)
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list)
    return data


def _legacy_group(api_client) -> dict:
    matches = [source for source in _get_sources(api_client) if source.get("title") == LEGACY_TITLE]
    assert len(matches) == 1, matches
    return matches[0]


class TestLegacyGroupBackfill:
    """Legacy GET backfill, persistence, and category mutation regression coverage."""

    def test_01_first_get_groups_legacy_parts_under_uuid(
        self, api_client, mongo_collection, legacy_seed
    ):
        grouped = _legacy_group(api_client)
        group_id = grouped.get("group_id")
        assert isinstance(group_id, str) and group_id
        assert group_id != LEGACY_URL
        assert str(uuid.UUID(group_id)) == group_id
        assert grouped["total_parts"] == 3
        assert set(grouped["parts"]) == set(legacy_seed["ids"])
        assert grouped["url"] == LEGACY_URL
        assert grouped["total_chars"] == sum(len(f"TEST legacy content part {i}") for i in range(1, 4))
        legacy_seed["group_id"] = group_id

        persisted = list(
            mongo_collection.find(
                {"id": {"$in": legacy_seed["ids"]}}, {"_id": 0, "id": 1, "group_id": 1}
            )
        )
        assert len(persisted) == 3
        assert {part.get("group_id") for part in persisted} == {group_id}

    def test_02_second_get_returns_same_persisted_uuid(self, api_client, legacy_seed):
        assert legacy_seed["group_id"], "First GET did not capture a group_id"
        grouped = _legacy_group(api_client)
        assert grouped["group_id"] == legacy_seed["group_id"]
        assert grouped["group_id"] != LEGACY_URL

    def test_03_patch_category_on_backfilled_legacy_group_succeeds(
        self, api_client, mongo_collection, legacy_seed
    ):
        group_id = legacy_seed["group_id"]
        response = api_client.patch(
            f"{BASE_URL}/api/knowledge/sources/group/{quote(group_id, safe='')}/category",
            json={"category": LEGACY_CATEGORY},
            timeout=30,
        )
        assert response.status_code == 200, response.text
        assert response.json() == {"success": True, "category": LEGACY_CATEGORY}
        grouped = _legacy_group(api_client)
        assert grouped["category"] == LEGACY_CATEGORY
        assert mongo_collection.count_documents(
            {"id": {"$in": legacy_seed["ids"]}, "category": LEGACY_CATEGORY}
        ) == 3

    def test_04_regular_single_source_category_still_works(self, api_client):
        source = next(
            item for item in _get_sources(api_client) if item.get("title") == "How to reset password"
        )
        source_id = source["parts"][0]
        original = source.get("category", "")
        try:
            response = api_client.patch(
                f"{BASE_URL}/api/knowledge/sources/{quote(source_id, safe='')}/category",
                json={"category": SINGLE_CATEGORY},
                timeout=30,
            )
            assert response.status_code == 200, response.text
            assert response.json() == {"success": True, "category": SINGLE_CATEGORY}
            updated = next(
                item for item in _get_sources(api_client) if item.get("title") == "How to reset password"
            )
            assert updated["category"] == SINGLE_CATEGORY
        finally:
            restore = api_client.patch(
                f"{BASE_URL}/api/knowledge/sources/{quote(source_id, safe='')}/category",
                json={"category": original},
                timeout=30,
            )
            assert restore.status_code == 200, restore.text

    def test_05_existing_proper_group_category_still_works(self, api_client):
        source = next(item for item in _get_sources(api_client) if item.get("title") == "Lace FAQ")
        group_id = source.get("group_id")
        assert isinstance(group_id, str) and group_id
        assert source.get("total_parts", 0) > 1
        original = source.get("category", "")
        try:
            response = api_client.patch(
                f"{BASE_URL}/api/knowledge/sources/group/{quote(group_id, safe='')}/category",
                json={"category": PROPER_GROUP_CATEGORY},
                timeout=30,
            )
            assert response.status_code == 200, response.text
            assert response.json() == {"success": True, "category": PROPER_GROUP_CATEGORY}
            updated = next(item for item in _get_sources(api_client) if item.get("title") == "Lace FAQ")
            assert updated["category"] == PROPER_GROUP_CATEGORY
        finally:
            restore = api_client.patch(
                f"{BASE_URL}/api/knowledge/sources/group/{quote(group_id, safe='')}/category",
                json={"category": original},
                timeout=30,
            )
            assert restore.status_code == 200, restore.text
