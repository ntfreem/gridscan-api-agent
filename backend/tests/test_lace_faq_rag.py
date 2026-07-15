"""
Iteration 23 - Lace FAQ RAG (JS-rendered scraping + chunking + relevance-window search)

Tests:
 1. Login as administrator
 2. GET /api/knowledge/sources for the Preview Cardano USDCx instance
    -> Verify 10+ Lace FAQ chunks exist, total content 80K+ chars
 3. POST /api/chat/send for 4 topical questions; verify the answer is on-topic
    and does NOT say "content didn't fully load".
"""

import os
import re
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rag-search-dev.preview.emergentagent.com").rstrip("/")
INSTANCE_ID = "5adabbd3-d173-478a-887e-9f8fd8de8d19"  # Preview - Cardano USDCx (has Lace FAQ)

FAIL_MARKERS = [
    "content didn't fully load",
    "didn't fully load",
    "I don't have any knowledge base configured",
]


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email_or_username": "administrator", "password": "Admin@123"},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def sources(token):
    r = requests.get(
        f"{BASE_URL}/api/knowledge/sources",
        headers={"Authorization": f"Bearer {token}", "X-Instance-ID": INSTANCE_ID},
        timeout=30,
    )
    assert r.status_code == 200, f"knowledge/sources failed: {r.status_code} {r.text}"
    return r.json()


# ----- Knowledge source chunk verification -----

class TestKnowledgeChunks:
    def test_lace_faq_multiple_chunks(self, sources):
        lace = [s for s in sources if "Lace FAQ" in (s.get("title") or "")]
        print(f"\n[chunks] found {len(lace)} Lace FAQ entries out of {len(sources)} total sources")
        assert len(lace) >= 10, f"Expected 10+ Lace FAQ chunks, got {len(lace)}"

    def test_lace_faq_total_content_size(self, sources):
        lace = [s for s in sources if "Lace FAQ" in (s.get("title") or "")]
        total = sum(len(s.get("content", "")) for s in lace)
        print(f"[chunks] total Lace FAQ content chars: {total}")
        assert total > 80000, f"Expected 80K+ total content chars, got {total}"

    def test_chunk_titles_have_part_marker(self, sources):
        lace = [s for s in sources if "Lace FAQ" in (s.get("title") or "")]
        with_part = [s for s in lace if re.search(r"\(part \d+/\d+\)", s.get("title", ""))]
        assert len(with_part) >= 10, (
            f"Expected chunks to have 'part N/M' markers, got {len(with_part)}: "
            f"{[s.get('title') for s in lace[:3]]}"
        )


# ----- Chat send: verify RAG answers are on-topic -----

def _send_chat(message: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/chat/send",
        json={
            "message": message,
            "instance_id": INSTANCE_ID,
            "session_id": str(uuid.uuid4()),
        },
        timeout=90,
    )
    assert r.status_code == 200, f"chat/send failed: {r.status_code} {r.text}"
    resp = r.json().get("response", "")
    print(f"\n[chat] Q: {message}\n[chat] A: {resp[:500]}\n---")
    for m in FAIL_MARKERS:
        assert m.lower() not in resp.lower(), f"Response contains failure marker '{m}': {resp[:300]}"
    assert len(resp) > 50, f"Response too short: {resp!r}"
    return resp.lower()


class TestChatAnswers:
    def test_staking_answer(self):
        resp = _send_chat("What is staking in Lace?")
        # Should mention delegation or stake pool or Cardano/ADA
        hits = sum(kw in resp for kw in ["delegat", "stake pool", "ada", "cardano"])
        assert hits >= 1, f"Staking answer not on-topic: {resp[:400]}"

    def test_hardware_wallet_answer(self):
        resp = _send_chat("How do I use a hardware wallet with Lace?")
        # Expect at least one specific brand/model
        hits = [kw for kw in ["ledger", "trezor", "keystone"] if kw in resp]
        assert hits, f"Hardware wallet answer missing brand: {resp[:400]}"

    def test_midnight_answer(self):
        resp = _send_chat("What is Midnight?")
        # Expect privacy or blockchain or midnight
        hits = sum(kw in resp for kw in ["privacy", "midnight", "blockchain", "data"])
        assert hits >= 1, f"Midnight answer not on-topic: {resp[:400]}"

    def test_token_swap_answer(self):
        resp = _send_chat("What is a token swap?")
        # Expect swap/exchange/dex context
        hits = sum(kw in resp for kw in ["swap", "exchange", "token", "dex"])
        assert hits >= 2, f"Token swap answer not on-topic: {resp[:400]}"
