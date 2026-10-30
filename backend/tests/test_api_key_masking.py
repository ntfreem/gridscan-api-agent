# API key masking on /api/admin/bot-config: GET masks value, empty PUT preserves key, non-empty PUT updates
import os
import uuid
import asyncio
import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"


def db_key():
    async def _q():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        d = await c[os.environ["DB_NAME"]].bot_config.find_one({"instance_id": INSTANCE_ID}, {"_id": 0})
        c.close()
        return (d or {}).get("api_key_value")
    return asyncio.run(_q())


@pytest.fixture(scope="module")
def admin():
    original = db_key()
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email_or_username": "administrator", "password": "Admin@123"})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}", "X-Instance-ID": INSTANCE_ID})
    yield s
    # restore real key
    s.put(f"{BASE_URL}/api/admin/bot-config", json={"api_key_value": original})
    assert db_key() == original


class TestMasking:
    def test_get_masks_key(self, admin):
        assert db_key(), "precondition: key saved in DB"
        g = admin.get(f"{BASE_URL}/api/admin/bot-config")
        assert g.status_code == 200
        d = g.json()
        assert d["api_key_value"] == ""
        assert d["api_key_value_set"] is True
        assert "_id" not in d

    def test_put_without_key_preserves(self, admin):
        before = db_key()
        r = admin.put(f"{BASE_URL}/api/admin/bot-config", json={"api_key_header": "x-project-id"})
        assert r.status_code == 200
        assert db_key() == before

    def test_put_empty_string_key_preserves(self, admin):
        # Direct API caller sending "" must not wipe the saved key
        before = db_key()
        r = admin.put(f"{BASE_URL}/api/admin/bot-config", json={"api_key_value": "", "api_key_header": "x-project-id"})
        print("PUT empty status", r.status_code)
        after = db_key()
        if after != before:
            # restore immediately so other tests are not affected
            admin.put(f"{BASE_URL}/api/admin/bot-config", json={"api_key_value": before})
        assert after == before, "Empty api_key_value via PUT overwrote saved key"

    def test_put_response_does_not_leak_key(self, admin):
        r = admin.put(f"{BASE_URL}/api/admin/bot-config", json={"api_key_header": "x-project-id"})
        assert r.status_code == 200
        assert not r.json().get("api_key_value"), "PUT response returns raw api_key_value (unmasked)"

    def test_put_new_key_updates(self, admin):
        new = f"TEST_key_{uuid.uuid4().hex[:8]}"
        r = admin.put(f"{BASE_URL}/api/admin/bot-config", json={"api_key_value": new})
        assert r.status_code == 200
        assert db_key() == new
        g = admin.get(f"{BASE_URL}/api/admin/bot-config").json()
        assert g["api_key_value"] == "" and g["api_key_value_set"] is True
