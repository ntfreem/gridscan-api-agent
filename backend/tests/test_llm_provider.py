"""Tests for per-instance LLM provider (multi-provider).

Covers:
- unit: _resolve_llm_config falls back to emergent when llm_config missing
- unit: _call_anthropic raises HTTPException when api_key empty
- unit: _call_anthropic raises HTTPException when model_short not in ALLOWED_ANTHROPIC_MODELS
- unit: ALLOWED_ANTHROPIC_MODELS contains exactly 3 entries with the expected keys
- API: GET/PUT /admin/instances/{id}/llm-config (auth, defaults, save, mask, preserve key,
       validation: bogus model, bogus provider, switch provider/model)
- API: POST /admin/instances/{id}/llm-config/test (always 200, success bool)
"""

import os
import sys
import uuid
import asyncio
import pytest
import requests
from fastapi import HTTPException

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Public URL — what the user sees (used for HTTP tests)
FRONTEND_ENV = "/app/frontend/.env"
BASE_URL = None
with open(FRONTEND_ENV) as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break
assert BASE_URL, "REACT_APP_BACKEND_URL not found"

import server  # noqa: E402


# ── Unit tests against the server module directly ───────────────────────────────


def test_allowlist_has_exactly_three_models():
    keys = set(server.ALLOWED_ANTHROPIC_MODELS.keys())
    assert keys == {"claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5"}
    assert len(server.ALLOWED_ANTHROPIC_MODELS) == 3


def test_resolve_llm_config_defaults_to_emergent(event_loop):
    inst_id = f"NOEXIST-{uuid.uuid4()}"
    cfg = event_loop.run_until_complete(server._resolve_llm_config(inst_id))
    assert cfg["provider"] == "emergent"
    assert cfg["model"] == server.DEFAULT_EMERGENT_MODEL


def test_call_anthropic_raises_on_empty_key(event_loop):
    with pytest.raises(HTTPException) as exc:
        event_loop.run_until_complete(
            server._call_anthropic("sess", "hi", "sys", "inst", "claude-sonnet-4-5", "")
        )
    assert exc.value.status_code == 500
    assert "anthropic" in str(exc.value.detail).lower() or "key" in str(exc.value.detail).lower()


def test_call_anthropic_raises_on_invalid_model(event_loop):
    with pytest.raises(HTTPException) as exc:
        event_loop.run_until_complete(
            server._call_anthropic("sess", "hi", "sys", "inst", "bogus-model-xyz", "sk-ant-fake")
        )
    assert exc.value.status_code == 500
    assert "allowlist" in str(exc.value.detail).lower() or "bogus" in str(exc.value.detail).lower()


# ── Cost helper unit tests ─────────────────────────────────────────────────────


def test_estimate_tokens_empty_returns_one():
    assert server._estimate_tokens("") == 1
    assert server._estimate_tokens(None) == 1


def test_estimate_tokens_hello_world():
    # ~4 chars/token heuristic; "hello world" = 11 chars => 11//4 = 2
    val = server._estimate_tokens("hello world")
    assert 2 <= val <= 3


def test_cost_for_sonnet_input_only():
    # $3 per 1M input tokens
    assert server._cost_for("claude-sonnet-4-5", 1_000_000, 0) == 3.0


def test_cost_for_sonnet_output_only():
    # $15 per 1M output tokens
    assert server._cost_for("claude-sonnet-4-5", 0, 1_000_000) == 15.0


def test_cost_for_opus_dated_model():
    # $15 + $75 = $90 for 1M in + 1M out (dated model id used by Emergent path)
    assert server._cost_for("claude-opus-4-5-20251101", 1_000_000, 1_000_000) == 90.0


def test_cost_for_ollama_always_zero():
    assert server._cost_for("ollama:llama3.1", 1_000_000, 1_000_000) == 0.0


def test_cost_for_unknown_model_uses_sonnet_default():
    # DEFAULT_PRICING = Sonnet ($3 + $15 = $18 for 1M+1M)
    assert server._cost_for("unknown-model", 1_000_000, 1_000_000) == 18.0


def test_cost_for_provider_prefixed_haiku():
    # 'anthropic:claude-haiku-4-5' => $1 + $5 = $6 for 1M+1M
    assert server._cost_for("anthropic:claude-haiku-4-5", 1_000_000, 1_000_000) == 6.0


def test_cost_for_empty_model_returns_zero():
    assert server._cost_for("", 1000, 1000) == 0.0


# ── Token capture wiring: monkeypatch each _call_* helper and verify
# call_claude dispatcher unpacks the tuple AND _log_llm_usage receives the tokens.


def _make_log_capture(monkeypatch):
    captured = {}

    async def fake_log(instance_id, session_id, platform, model_used, model_attempted,
                      success, retry_count, used_fallback, error_type,
                      input_tokens=0, output_tokens=0):
        captured["input_tokens"] = input_tokens
        captured["output_tokens"] = output_tokens
        captured["model_used"] = model_used
        captured["success"] = success

    monkeypatch.setattr(server, "_log_llm_usage", fake_log)
    return captured


def test_dispatcher_unpacks_emergent_tuple(monkeypatch, event_loop):
    captured = _make_log_capture(monkeypatch)

    async def fake_emergent(session_id, user_message, system_prompt, instance_id, model):
        return ("pong", 42, 7)

    async def fake_resolve(_inst):
        return {"provider": "emergent", "model": "claude-opus-4-5-20251101"}

    monkeypatch.setattr(server, "_call_emergent", fake_emergent)
    monkeypatch.setattr(server, "_resolve_llm_config", fake_resolve)
    monkeypatch.setenv("CLAUDE_API_KEY", "sk-emergent-fake-for-test")

    text = event_loop.run_until_complete(
        server.call_claude("sess", "hi", "sys", instance_id="inst", platform="web")
    )
    assert text == "pong"
    assert captured["input_tokens"] == 42
    assert captured["output_tokens"] == 7
    assert captured["success"] is True


def test_dispatcher_unpacks_anthropic_tuple(monkeypatch, event_loop):
    captured = _make_log_capture(monkeypatch)

    async def fake_anth(session_id, user_message, system_prompt, instance_id, model_short, api_key):
        return ("hello", 100, 50)

    async def fake_resolve(_inst):
        return {"provider": "anthropic", "model": "claude-sonnet-4-5", "anthropic_api_key": "sk-ant-x"}

    monkeypatch.setattr(server, "_call_anthropic", fake_anth)
    monkeypatch.setattr(server, "_resolve_llm_config", fake_resolve)

    text = event_loop.run_until_complete(
        server.call_claude("sess", "hi", "sys", instance_id="inst", platform="web")
    )
    assert text == "hello"
    assert captured["input_tokens"] == 100
    assert captured["output_tokens"] == 50
    assert captured["model_used"] == "anthropic:claude-sonnet-4-5"


def test_dispatcher_unpacks_ollama_tuple(monkeypatch, event_loop):
    captured = _make_log_capture(monkeypatch)

    async def fake_oll(session_id, user_message, system_prompt, instance_id, model, base_url):
        return ("yo", 200, 80)

    async def fake_resolve(_inst):
        return {"provider": "ollama", "model": "llama3.1", "ollama_base_url": "http://x"}

    monkeypatch.setattr(server, "_call_ollama", fake_oll)
    monkeypatch.setattr(server, "_resolve_llm_config", fake_resolve)

    text = event_loop.run_until_complete(
        server.call_claude("sess", "hi", "sys", instance_id="inst", platform="web")
    )
    assert text == "yo"
    assert captured["input_tokens"] == 200
    assert captured["output_tokens"] == 80
    assert captured["model_used"] == "ollama:llama3.1"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── HTTP tests (admin auth, end-to-end through public ingress) ──────────────────


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": "administrator",
        "password": "Admin@123",
    })
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def instance_id(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/instances", headers=admin_headers)
    assert r.status_code == 200, f"List instances failed: {r.text[:200]}"
    arr = r.json()
    if not arr:
        # Create a fresh test instance
        c = requests.post(f"{BASE_URL}/api/admin/instances", headers=admin_headers,
                          json={"name": f"TEST_llm_{uuid.uuid4().hex[:6]}", "description": "llm-provider tests"})
        assert c.status_code in (200, 201), c.text
        return c.json()["id"]
    return arr[0]["id"]


def test_get_llm_config_requires_auth(instance_id):
    r = requests.get(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config")
    assert r.status_code in (401, 403), f"unauth GET returned {r.status_code}"


def test_get_llm_config_defaults(instance_id, admin_headers):
    # Reset to a clean emergent config first
    requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
                 headers=admin_headers, json={"provider": "emergent", "model": ""})
    r = requests.get(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config", headers=admin_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["provider"] == "emergent"
    assert "default_models" in body and "emergent" in body["default_models"]
    assert isinstance(body["allowed_anthropic_models"], list) and len(body["allowed_anthropic_models"]) == 3


def test_put_emergent_no_model_succeeds(instance_id, admin_headers):
    r = requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
                     headers=admin_headers, json={"provider": "emergent"})
    assert r.status_code == 200, r.text
    assert r.json().get("success") is True


def test_put_anthropic_with_key_and_mask_preview(instance_id, admin_headers):
    fake_key = "sk-ant-test-abcdef1234567890"
    r = requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
                     headers=admin_headers, json={
                         "provider": "anthropic",
                         "model": "claude-sonnet-4-5",
                         "anthropic_api_key": fake_key,
                     })
    assert r.status_code == 200, r.text
    g = requests.get(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config", headers=admin_headers)
    body = g.json()
    assert body["provider"] == "anthropic"
    assert body["model"] == "claude-sonnet-4-5"
    assert body["anthropic_api_key_set"] is True
    assert body["anthropic_api_key_preview"].startswith("sk-ant-")
    assert body["anthropic_api_key_preview"].endswith(fake_key[-4:])
    assert fake_key not in body["anthropic_api_key_preview"], "Full key should not be exposed"


def test_put_anthropic_invalid_model_returns_400(instance_id, admin_headers):
    r = requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
                     headers=admin_headers, json={
                         "provider": "anthropic",
                         "model": "bogus-model",
                     })
    assert r.status_code == 400, r.text
    assert "must be one of" in r.text.lower() or "claude-sonnet-4-5" in r.text


def test_put_unsupported_provider_returns_400(instance_id, admin_headers):
    r = requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
                     headers=admin_headers, json={"provider": "openai", "model": "gpt-4"})
    assert r.status_code == 400, r.text


def test_put_empty_key_preserves_existing(instance_id, admin_headers):
    # Pre-seed a key
    seed = "sk-ant-existing-preserve-test-xyz9"
    requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
                 headers=admin_headers, json={
                     "provider": "anthropic", "model": "claude-sonnet-4-5",
                     "anthropic_api_key": seed,
                 })
    # Update model only with empty key
    r = requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
                     headers=admin_headers, json={
                         "provider": "anthropic", "model": "claude-haiku-4-5",
                         "anthropic_api_key": "",
                     })
    assert r.status_code == 200, r.text
    g = requests.get(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config", headers=admin_headers).json()
    assert g["anthropic_api_key_set"] is True
    assert g["anthropic_api_key_preview"].endswith(seed[-4:]), "Existing key should be preserved"
    assert g["model"] == "claude-haiku-4-5"


def test_put_ollama_saves(instance_id, admin_headers):
    r = requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
                     headers=admin_headers, json={
                         "provider": "ollama",
                         "model": "llama3.1",
                         "ollama_base_url": "http://localhost:11434",
                     })
    assert r.status_code == 200, r.text
    g = requests.get(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config", headers=admin_headers).json()
    assert g["provider"] == "ollama"
    assert g["ollama_base_url"] == "http://localhost:11434"


def test_test_endpoint_emergent_success(instance_id, admin_headers):
    # Restore emergent first
    requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
                 headers=admin_headers, json={"provider": "emergent", "model": ""})
    r = requests.post(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config/test",
                      headers=admin_headers, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "success" in body
    # For real Emergent path with valid key in env, expect success:true and pong response
    if body["success"]:
        assert "pong" in (body.get("response") or "").lower()


def test_test_endpoint_anthropic_bad_key_graceful(instance_id, admin_headers):
    # Save a fake key, then call /test — must return 200 with success:false (graceful)
    requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
                 headers=admin_headers, json={
                     "provider": "anthropic", "model": "claude-sonnet-4-5",
                     "anthropic_api_key": "sk-ant-aaaa",
                 })
    r = requests.post(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config/test",
                      headers=admin_headers, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is False
    err = (body.get("error") or "").lower()
    assert any(t in err for t in ("auth", "401", "invalid", "anthropic")), f"Expected auth error, got: {err}"


def test_test_endpoint_ollama_unreachable_graceful(instance_id, admin_headers):
    requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
                 headers=admin_headers, json={
                     "provider": "ollama", "model": "llama3.1",
                     "ollama_base_url": "http://127.0.0.1:1",  # closed port
                 })
    r = requests.post(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config/test",
                      headers=admin_headers, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is False
    # Restore emergent for cleanliness
    requests.put(f"{BASE_URL}/api/admin/instances/{instance_id}/llm-config",
                 headers=admin_headers, json={"provider": "emergent", "model": ""})
