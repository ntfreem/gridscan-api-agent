"""Tests for /api/discord/scripted-counters/{count,reset} endpoints.

Verifies:
- count endpoint scopes to current instance only (other instances' counters not counted)
- reset endpoint deletes all docs in scripted_counters for the current instance
- reset is idempotent (cleared=0 when nothing exists)
- reset does NOT touch scripted_skips analytics collection
- counters from other instances are untouched by reset
- both endpoints require auth (401) and X-Instance-ID header
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timezone
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', '')
DB_NAME = os.environ.get('DB_NAME', '')
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"


# --- fixtures ---------------------------------------------------------------

@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD,
    })
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def instance_id(auth_token):
    r = requests.get(
        f"{BASE_URL}/api/admin/instances",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    if r.status_code != 200:
        pytest.skip(f"admin/instances failed: {r.status_code} {r.text}")
    items = r.json()
    if not items:
        pytest.skip("No instances available to test")
    return items[0]["id"]


@pytest.fixture(scope="module")
def auth_headers(auth_token, instance_id):
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Instance-ID": instance_id,
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="module")
def db():
    if not MONGO_URL or not DB_NAME:
        pytest.skip("MONGO_URL / DB_NAME not configured for direct DB seeding")
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(autouse=True)
def cleanup_test_counters(db, instance_id):
    """Best-effort cleanup of any TEST_ docs we seed."""
    yield
    try:
        db.scripted_counters.delete_many({"user_id": {"$regex": "^TEST_"}})
        db.scripted_skips.delete_many({"user_id": {"$regex": "^TEST_"}})
    except Exception:
        pass


def _seed_counter(db, instance_id, user_id, channel_id="TEST_chan", count=2):
    db.scripted_counters.insert_one({
        "instance_id": instance_id,
        "channel_id": channel_id,
        "user_id": user_id,
        "count": count,
        "last_at": datetime.now(timezone.utc).isoformat(),
    })


# --- tests -----------------------------------------------------------------

class TestScriptedCountersAuth:
    """Auth and header requirements."""

    def test_count_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/discord/scripted-counters/count")
        assert r.status_code in (401, 403), r.text

    def test_reset_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/discord/scripted-counters/reset")
        assert r.status_code in (401, 403), r.text

    def test_count_requires_instance_header(self, auth_token):
        r = requests.get(
            f"{BASE_URL}/api/discord/scripted-counters/count",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        # backend returns 400 with detail "X-Instance-ID header required"
        assert r.status_code in (400, 422), r.text

    def test_reset_requires_instance_header(self, auth_token):
        r = requests.post(
            f"{BASE_URL}/api/discord/scripted-counters/reset",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert r.status_code in (400, 422), r.text


class TestScriptedCountersCount:
    """GET /api/discord/scripted-counters/count behaviour."""

    def test_count_returns_zero_after_reset(self, auth_headers):
        # Reset first to get a clean baseline
        requests.post(
            f"{BASE_URL}/api/discord/scripted-counters/reset",
            headers=auth_headers,
        )
        r = requests.get(
            f"{BASE_URL}/api/discord/scripted-counters/count",
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "active_counters" in data
        assert "skips_last_24h" in data
        assert data["active_counters"] == 0
        assert isinstance(data["active_counters"], int)
        assert isinstance(data["skips_last_24h"], int)

    def test_count_reflects_seeded_counters(self, auth_headers, instance_id, db):
        # baseline reset
        requests.post(
            f"{BASE_URL}/api/discord/scripted-counters/reset",
            headers=auth_headers,
        )
        # seed 3 docs
        for i in range(3):
            _seed_counter(db, instance_id, f"TEST_user_{i}")

        r = requests.get(
            f"{BASE_URL}/api/discord/scripted-counters/count",
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        assert r.json()["active_counters"] == 3

    def test_count_does_not_include_other_instance(self, auth_headers, instance_id, db):
        # baseline reset
        requests.post(
            f"{BASE_URL}/api/discord/scripted-counters/reset",
            headers=auth_headers,
        )
        other_instance = f"TEST_other_{uuid.uuid4().hex[:8]}"
        try:
            # seed for the current instance and another fake instance
            _seed_counter(db, instance_id, "TEST_user_self")
            _seed_counter(db, other_instance, "TEST_user_other")
            _seed_counter(db, other_instance, "TEST_user_other2")

            r = requests.get(
                f"{BASE_URL}/api/discord/scripted-counters/count",
                headers=auth_headers,
            )
            assert r.status_code == 200, r.text
            # Only the 1 belonging to our instance should be counted
            assert r.json()["active_counters"] == 1
        finally:
            db.scripted_counters.delete_many({"instance_id": other_instance})


class TestScriptedCountersReset:
    """POST /api/discord/scripted-counters/reset behaviour."""

    def test_reset_when_empty_is_idempotent(self, auth_headers):
        # ensure empty
        requests.post(
            f"{BASE_URL}/api/discord/scripted-counters/reset",
            headers=auth_headers,
        )
        # second call should return cleared=0
        r = requests.post(
            f"{BASE_URL}/api/discord/scripted-counters/reset",
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert data.get("cleared") == 0

    def test_reset_clears_all_counters_for_instance(self, auth_headers, instance_id, db):
        # baseline
        requests.post(
            f"{BASE_URL}/api/discord/scripted-counters/reset",
            headers=auth_headers,
        )
        for i in range(5):
            _seed_counter(db, instance_id, f"TEST_user_seed_{i}")

        # verify count = 5
        c = requests.get(
            f"{BASE_URL}/api/discord/scripted-counters/count",
            headers=auth_headers,
        )
        assert c.json()["active_counters"] == 5

        # reset
        r = requests.post(
            f"{BASE_URL}/api/discord/scripted-counters/reset",
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["cleared"] == 5

        # verify count = 0
        c2 = requests.get(
            f"{BASE_URL}/api/discord/scripted-counters/count",
            headers=auth_headers,
        )
        assert c2.json()["active_counters"] == 0

    def test_reset_does_not_touch_other_instance(self, auth_headers, instance_id, db):
        requests.post(
            f"{BASE_URL}/api/discord/scripted-counters/reset",
            headers=auth_headers,
        )
        other_instance = f"TEST_other_keep_{uuid.uuid4().hex[:8]}"
        try:
            _seed_counter(db, instance_id, "TEST_user_self_a")
            _seed_counter(db, instance_id, "TEST_user_self_b")
            _seed_counter(db, other_instance, "TEST_user_other_a")
            _seed_counter(db, other_instance, "TEST_user_other_b")

            r = requests.post(
                f"{BASE_URL}/api/discord/scripted-counters/reset",
                headers=auth_headers,
            )
            assert r.status_code == 200
            assert r.json()["cleared"] == 2  # only ours

            # the other instance docs should still be present
            remaining_other = db.scripted_counters.count_documents({"instance_id": other_instance})
            assert remaining_other == 2

            # and our instance is empty
            remaining_self = db.scripted_counters.count_documents({"instance_id": instance_id})
            assert remaining_self == 0
        finally:
            db.scripted_counters.delete_many({"instance_id": other_instance})

    def test_reset_does_not_clear_scripted_skips(self, auth_headers, instance_id, db):
        # baseline
        requests.post(
            f"{BASE_URL}/api/discord/scripted-counters/reset",
            headers=auth_headers,
        )
        # seed counters AND a skips analytics record
        _seed_counter(db, instance_id, "TEST_user_skipcheck")
        skip_marker_id = f"TEST_skip_{uuid.uuid4().hex[:8]}"
        db.scripted_skips.insert_one({
            "instance_id": instance_id,
            "channel_id": "TEST_chan",
            "user_id": skip_marker_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        try:
            r = requests.post(
                f"{BASE_URL}/api/discord/scripted-counters/reset",
                headers=auth_headers,
            )
            assert r.status_code == 200
            assert r.json()["cleared"] >= 1

            # scripted_skips marker MUST still be present
            still_there = db.scripted_skips.count_documents({"user_id": skip_marker_id})
            assert still_there == 1, "reset_scripted_counters must NOT touch scripted_skips"
        finally:
            db.scripted_skips.delete_many({"user_id": skip_marker_id})
