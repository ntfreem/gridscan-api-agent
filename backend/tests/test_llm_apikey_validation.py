"""Tests for the new LLM model-field API-key validation + corrected model IDs.

Covers (Jan 2026 fixes):
- POST /llm-config/test for emergent provider returns success:true with 'pong'
- PUT /llm-config rejects model values starting with sk- or bbk_ (400)
- PUT /llm-config accepts new anthropic short names (claude-sonnet-4-6, claude-sonnet-4-5)
- PUT /llm-config rejects bogus anthropic models (400)
- POST /llm-config/test for anthropic with fake key returns success:false (not raises)
- ALLOWED_ANTHROPIC_MODELS contains new entries; date suffixes are correct
"""

import os
import re
import sys
import time
import uuid
import pytest
import requests

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

with open("/app/frontend/.env") as f:
    BASE_URL = next(
        (ln.split("=", 1)[1].strip().rstrip("/") for ln in f if ln.startswith("REACT_APP_BACKEND_URL=")),
        None,
    )
assert BASE_URL, "REACT_APP_BACKEND_URL missing"

import server  # noqa


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_username": "administrator", "password": "Admin@123"},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def instance_id(headers):
    """Pick any existing instance; create one if none exist."""
    r = requests.get(f"{BASE_URL}/api/admin/instances", headers=headers, timeout=10)
    assert r.status_code == 200
    arr = r.json()
    if arr:
        return arr[0]["id"]
    # create
    r = requests.post(
        f"{BASE_URL}/api/admin/instances",
        json={"name": f"TEST_llmkey_{uuid.uuid4().hex[:6]}", "slug": f"test-llmkey-{uuid.uuid4().hex[:6]}"},
        headers=headers, timeout=10,
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


# ---------- constants ----------

def test_allowed_models_have_correct_date_suffixes():
    assert server.ALLOWED_ANTHROPIC_MODELS["claude-haiku-4-5"]  == "claude-haiku-4-5-20251001"
    assert server.ALLOWED_ANTHROPIC_MODELS["claude-sonnet-4-5"] == "claude-sonnet-4-5-20250929"
    assert server.ALLOWED_ANTHROPIC_MODELS["claude-opus-4-5"]   == "claude-opus-4-5-20251101"
    # new ones may be bare or dated; just check presence
    assert "claude-sonnet-4-6" in server.ALLOWED_ANTHROPIC_MODELS
    assert "claude-opus-4-8" in server.ALLOWED_ANTHROPIC_MODELS


def test_default_emergent_model_updated():
    assert server.DEFAULT_EMERGENT_MODEL == "claude-sonnet-4-6"
    assert server.DEFAULT_ANTHROPIC_MODEL == "claude-sonnet-4-6"


def test_pricing_table_extended():
    assert "claude-sonnet-4-6" in server.LLM_PRICING
    assert "claude-opus-4-6" in server.LLM_PRICING
    assert "claude-opus-4-7" in server.LLM_PRICING
    assert "claude-opus-4-8" in server.LLM_PRICING
    assert "claude-sonnet-4-5-20250929" in server.LLM_PRICING
    # broken/removed legacy id should not be there
    assert "claude-sonnet-4-5-20251101" not in server.LLM_PRICING


# ---------- BUG FIX 1: emergent test connection returns pong ----------

def test_emergent_test_connection_returns_pong(headers, instance_id):
    # Reset to emergent with no model (uses default)
    r = requests.put(
        f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
        json={"provider": "emergent", "model": None, "anthropic_api_key": None, "ollama_base_url": None},
        headers=headers, timeout=10,
    )
    assert r.status_code == 200, r.text

    r = requests.post(
        f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config/test",
        headers=headers, timeout=60,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    # Must succeed (no more "AI service temporarily unavailable")
    assert data.get("success") is True, f"emergent test failed: {data}"
    response_text = (data.get("response") or "").lower()
    assert "pong" in response_text, f"expected pong, got: {data.get('response')!r}"


# ---------- BUG FIX 2: emergent with short model claude-sonnet-4-5 also works ----------

def test_emergent_test_connection_with_short_sonnet(headers, instance_id):
    r = requests.put(
        f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
        json={"provider": "emergent", "model": "claude-sonnet-4-5", "anthropic_api_key": None, "ollama_base_url": None},
        headers=headers, timeout=10,
    )
    assert r.status_code == 200, r.text

    r = requests.post(
        f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config/test",
        headers=headers, timeout=60,
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True, f"emergent+sonnet-4-5 failed: {data}"


# ---------- BUG FIX 3: reject api-key-shaped model values ----------

@pytest.mark.parametrize("bad_model", [
    "sk-emergent-dDaA292Ef6fAa5e3aB",
    "sk-ant-api03-abc123",
    "sk-EmErGeNt-CASE-MIX",
    "bbk_abc123def456",
    "bbk_TEST",
])
def test_put_llm_config_rejects_api_key_in_model(headers, instance_id, bad_model):
    r = requests.put(
        f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
        json={"provider": "emergent", "model": bad_model},
        headers=headers, timeout=10,
    )
    assert r.status_code == 400, f"expected 400 for model={bad_model!r}, got {r.status_code}: {r.text}"
    detail = (r.json().get("detail") or "").lower()
    assert ("api key" in detail) or ("model name" in detail), f"unexpected detail: {detail!r}"


# ---------- BUG FIX 4: anthropic test with invalid key returns success:false (no raise) ----------

def test_anthropic_test_connection_with_fake_key_returns_false(headers, instance_id):
    r = requests.put(
        f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
        json={"provider": "anthropic", "model": "claude-sonnet-4-5", "anthropic_api_key": "sk-ant-fake-key-for-test"},
        headers=headers, timeout=10,
    )
    assert r.status_code == 200, r.text

    r = requests.post(
        f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config/test",
        headers=headers, timeout=30,
    )
    # Endpoint must not raise — should always return 200 with success flag
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is False, f"expected success=false with bad key, got {data}"
    assert "error" in data and data["error"], "error message should be present"


# ---------- BUG FIX 5: anthropic save with new short names + bogus rejection ----------

@pytest.mark.parametrize("good_model", ["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5", "claude-opus-4-8"])
def test_anthropic_save_accepts_allowed_models(headers, instance_id, good_model):
    r = requests.put(
        f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
        json={"provider": "anthropic", "model": good_model, "anthropic_api_key": "sk-ant-fake"},
        headers=headers, timeout=10,
    )
    assert r.status_code == 200, f"model={good_model} rejected: {r.status_code} {r.text}"


def test_anthropic_save_rejects_bogus_model(headers, instance_id):
    r = requests.put(
        f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
        json={"provider": "anthropic", "model": "bogus-not-a-real-model", "anthropic_api_key": "sk-ant-fake"},
        headers=headers, timeout=10,
    )
    assert r.status_code == 400, r.text
    detail = (r.json().get("detail") or "").lower()
    assert "anthropic" in detail or "must be one of" in detail


# ---------- restore to emergent default for cleanliness ----------

def test_zzz_restore_emergent_default(headers, instance_id):
    r = requests.put(
        f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
        json={"provider": "emergent", "model": None, "anthropic_api_key": None, "ollama_base_url": None},
        headers=headers, timeout=10,
    )
    assert r.status_code == 200
