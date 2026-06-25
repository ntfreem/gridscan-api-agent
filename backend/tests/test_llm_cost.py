"""HTTP-level tests for the per-instance Cost Dashboard endpoint
GET /api/analytics/llm-cost.

Validates:
  - auth & X-Instance-ID gating
  - response shape & daily series length (30)
  - cost & by_model aggregation after seeding 3 docs
  - $ifNull fallback when legacy docs lack input_tokens/output_tokens
  - forecast extrapolation = (mtd / day_of_month) * days_in_month
"""

import os
import sys
import uuid
import calendar
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

FRONTEND_ENV = "/app/frontend/.env"
BASE_URL = None
with open(FRONTEND_ENV) as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break
assert BASE_URL, "REACT_APP_BACKEND_URL not found"

# Load Mongo creds straight from backend/.env so seeding bypasses motor's loop binding.
_BACKEND_ENV = os.path.join(BACKEND_DIR, ".env")
_MONGO_URL = None
_DB_NAME = None
with open(_BACKEND_ENV) as f:
    for line in f:
        line = line.strip()
        if line.startswith("MONGO_URL="):
            _MONGO_URL = line.split("=", 1)[1].strip().strip('"')
        elif line.startswith("DB_NAME="):
            _DB_NAME = line.split("=", 1)[1].strip().strip('"')
assert _MONGO_URL and _DB_NAME, "Mongo env not loaded"

_sync_db = MongoClient(_MONGO_URL)[_DB_NAME]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": "administrator",
        "password": "Admin@123",
    })
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def instance_id(admin_headers):
    """Use a dedicated test instance so seed data doesn't pollute the real one."""
    name = f"TEST_costdash_{uuid.uuid4().hex[:6]}"
    c = requests.post(f"{BASE_URL}/api/admin/instances", headers=admin_headers,
                      json={"name": name, "description": "cost-dashboard tests"})
    assert c.status_code in (200, 201), c.text
    iid = c.json()["id"]
    yield iid
    # Best-effort cleanup
    try:
        requests.delete(f"{BASE_URL}/api/admin/instances/{iid}", headers=admin_headers, timeout=10)
    except Exception:
        pass


def _instance_headers(admin_headers, iid):
    h = dict(admin_headers)
    h["X-Instance-ID"] = iid
    return h


# ── Auth & header gating ───────────────────────────────────────────────────────


def test_llm_cost_without_auth_returns_401(instance_id):
    r = requests.get(f"{BASE_URL}/api/analytics/llm-cost",
                     headers={"X-Instance-ID": instance_id})
    assert r.status_code in (401, 403), r.text


def test_llm_cost_without_instance_header_returns_400(admin_headers):
    r = requests.get(f"{BASE_URL}/api/analytics/llm-cost", headers=admin_headers)
    assert r.status_code in (400, 422), r.text


# ── Shape validation on a fresh (empty) instance ───────────────────────────────


def test_llm_cost_shape_empty_instance(instance_id, admin_headers):
    r = requests.get(f"{BASE_URL}/api/analytics/llm-cost",
                     headers=_instance_headers(admin_headers, instance_id))
    assert r.status_code == 200, r.text
    body = r.json()

    # top-level keys
    for k in ("month_to_date", "by_model", "daily", "forecast_month_end_usd", "last_30d_cost_usd"):
        assert k in body, f"missing key {k}"

    mtd = body["month_to_date"]
    for k in ("cost_usd", "input_tokens", "output_tokens", "calls", "day_of_month", "days_in_month"):
        assert k in mtd, f"missing month_to_date.{k}"

    now = datetime.now(timezone.utc)
    assert mtd["day_of_month"] == now.day
    assert mtd["days_in_month"] == calendar.monthrange(now.year, now.month)[1]
    assert 28 <= mtd["days_in_month"] <= 31

    # daily sparkline = 30 buckets, each with date + cost_usd
    assert isinstance(body["daily"], list)
    assert len(body["daily"]) == 30
    for d in body["daily"]:
        assert "date" in d and "cost_usd" in d
        assert isinstance(d["cost_usd"], (int, float))

    # Empty instance => all zeros
    assert mtd["calls"] == 0
    assert mtd["cost_usd"] == 0.0
    assert body["by_model"] == []
    assert body["forecast_month_end_usd"] == 0.0


# ── Seed 3 llm_usage docs and validate aggregation ─────────────────────────────


def _seed(iid, model, in_tok, out_tok):
    """Insert one llm_usage record dated to *today* (so it falls in MTD)."""
    doc = {
        "id": str(uuid.uuid4()),
        "instance_id": iid,
        "session_id": f"TEST_{uuid.uuid4().hex[:6]}",
        "platform": "web",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model_attempted": model,
        "model_used": model,
        "success": True,
        "retry_count": 0,
        "used_fallback": False,
        "error_type": None,
        "input_tokens": in_tok,
        "output_tokens": out_tok,
    }
    _sync_db.llm_usage.insert_one(doc)
    return doc["id"]


def _seed_legacy(iid, model):
    """Insert an old-style record WITHOUT input_tokens/output_tokens fields
    to exercise the $ifNull aggregation fallback."""
    doc = {
        "id": str(uuid.uuid4()),
        "instance_id": iid,
        "session_id": f"TEST_LEGACY_{uuid.uuid4().hex[:6]}",
        "platform": "web",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model_attempted": model,
        "model_used": model,
        "success": True,
        "retry_count": 0,
        "used_fallback": False,
        "error_type": None,
    }
    _sync_db.llm_usage.insert_one(doc)
    return doc["id"]


def test_llm_cost_with_seeded_records(instance_id, admin_headers):
    seeded_ids = []
    try:
        # Sonnet: 1000 in / 500 out  => 0.003 + 0.0075 = 0.0105
        seeded_ids.append(_seed(instance_id, "anthropic:claude-sonnet-4-5", 1000, 500))
        # Haiku: 5000 in / 100 out   => 0.005 + 0.0005 = 0.0055
        seeded_ids.append(_seed(instance_id, "anthropic:claude-haiku-4-5", 5000, 100))
        # Ollama: 10000 / 20000 => $0
        seeded_ids.append(_seed(instance_id, "ollama:llama3", 10000, 20000))
        # Legacy: no token fields → $ifNull defaults to 0
        seeded_ids.append(_seed_legacy(instance_id, "claude-opus-4-5-20251101"))

        r = requests.get(f"{BASE_URL}/api/analytics/llm-cost",
                         headers=_instance_headers(admin_headers, instance_id))
        assert r.status_code == 200, r.text
        body = r.json()

        # 4 records => 4 calls
        mtd = body["month_to_date"]
        assert mtd["calls"] == 4
        assert mtd["input_tokens"] == 1000 + 5000 + 10000  # legacy = 0
        assert mtd["output_tokens"] == 500 + 100 + 20000

        # by_model should contain 4 distinct entries (sonnet, haiku, ollama, opus-legacy)
        by_model = {row["model"]: row for row in body["by_model"]}
        assert "anthropic:claude-sonnet-4-5" in by_model
        assert "anthropic:claude-haiku-4-5" in by_model
        assert "ollama:llama3" in by_model
        assert "claude-opus-4-5-20251101" in by_model

        sonnet = by_model["anthropic:claude-sonnet-4-5"]
        assert sonnet["provider"] == "anthropic"
        assert sonnet["calls"] == 1
        assert abs(sonnet["cost_usd"] - 0.0105) < 1e-6

        haiku = by_model["anthropic:claude-haiku-4-5"]
        assert haiku["provider"] == "anthropic"
        assert abs(haiku["cost_usd"] - 0.0055) < 1e-6

        ollama = by_model["ollama:llama3"]
        assert ollama["provider"] == "ollama"
        assert ollama["cost_usd"] == 0.0
        assert ollama["input_tokens"] == 10000
        assert ollama["output_tokens"] == 20000

        # The legacy opus row should contribute $0 because $ifNull defaults the missing
        # input_tokens/output_tokens fields to 0 → _cost_for returns 0.
        opus_legacy = by_model["claude-opus-4-5-20251101"]
        assert opus_legacy["input_tokens"] == 0
        assert opus_legacy["output_tokens"] == 0
        assert opus_legacy["cost_usd"] == 0.0

        # Total MTD cost matches sum of computed model costs
        expected_total = round(0.0105 + 0.0055 + 0.0 + 0.0, 4)
        assert abs(mtd["cost_usd"] - expected_total) < 1e-4

        # Forecast linear extrapolation
        now = datetime.now(timezone.utc)
        days_in_month = calendar.monthrange(now.year, now.month)[1]
        expected_forecast = round((expected_total / now.day) * days_in_month, 2)
        assert abs(body["forecast_month_end_usd"] - expected_forecast) < 0.01

        # Daily series remains length 30 with today's bucket containing non-zero cost
        assert len(body["daily"]) == 30
        today_bucket = body["daily"][-1]  # series ordered oldest→newest
        assert today_bucket["cost_usd"] >= expected_total - 1e-4

        # Regression guard: if dispatcher tuple unpacking is ever reverted to log 0/0,
        # by-model cost would collapse to 0. Assert > 0 for the anthropic rows.
        assert sonnet["cost_usd"] > 0
        assert haiku["cost_usd"] > 0

    finally:
        # Cleanup seeded docs
        for sid in seeded_ids:
            try:
                _sync_db.llm_usage.delete_one({"id": sid})
            except Exception:
                pass
