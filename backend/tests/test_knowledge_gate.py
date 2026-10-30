# Knowledge Gate Protocol regression tests: bot must answer ONLY from KB content
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

REFUSAL_MARKERS = ["don't have information", "do not have information", "not in my knowledge base",
                   "knowledge base doesn't", "knowledge base does not"]
GENERAL_KNOWLEDGE_PHRASES = ["general ai training", "my training", "training knowledge",
                             "training data", "general knowledge"]
HEDGES = ["i think", "i believe", "i'm not sure", "you may want to verify", "i cannot confirm"]


def ask(msg):
    r = requests.post(f"{BASE_URL}/api/chat/send",
                      json={"message": msg, "instance_id": INSTANCE_ID,
                            "session_id": f"TEST_kg_{uuid.uuid4()}"}, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data.get("response"), str) and data["response"].strip()
    print(f"\nQ: {msg}\nA: {data['response']}\n")
    return data["response"].lower()


def is_refusal(t):
    return any(m in t.replace("’", "'") for m in REFUSAL_MARKERS)


def no_general_phrases(t):
    return not any(p in t for p in GENERAL_KNOWLEDGE_PHRASES)


class TestKnowledgeGate:
    # KB-covered question -> confident answer from KB
    def test_kb_question_confident(self):
        t = ask("How do I check a Cardano account balance with Gridscan?")
        assert "/accounts/" in t or "accounts/{address}" in t
        assert not any(h in t for h in HEDGES)
        assert no_general_phrases(t)
        assert not is_refusal(t)

    # Blockfrost/Koios not in KB -> refuse, no details
    def test_blockfrost_koios_refused(self):
        t = ask("Tell me about Blockfrost and Koios APIs")
        assert is_refusal(t)
        assert no_general_phrases(t)
        for bad in ["project_id", "project id", "ogmios", "postgrest", "cardano-db-sync", "api key from blockfrost",
                    "blockfrost.io", "koios.rest"]:
            assert bad not in t, f"leaked general knowledge: {bad}"

    # Unrelated question -> refuse
    def test_capital_of_france_refused(self):
        t = ask("What is the capital of France?")
        assert is_refusal(t)
        assert "paris" not in t
        assert no_general_phrases(t)

    # Partially related, not in KB -> no supplementing
    def test_partial_related_not_supplemented(self):
        t = ask("How do I submit a transaction or mint an NFT on Cardano using Gridscan?")
        assert no_general_phrases(t)
        for bad in ["cardano-cli", "policy id", "policy script", "cbor", "plutus", "metadata label 721"]:
            assert bad not in t, f"leaked general knowledge: {bad}"
        assert is_refusal(t) or "not" in t

    # Another partial: rate limits / auth not in KB
    def test_rate_limits_not_invented(self):
        t = ask("What are the Gridscan API rate limits and how do I authenticate?")
        assert no_general_phrases(t)
        assert is_refusal(t) or "doesn't" in t or "does not" in t or "not " in t
        assert "requests per second" not in t or is_refusal(t)

    # Alternatives request -> should not name other services
    def test_no_alternative_services(self):
        t = ask("What other Cardano APIs can I use besides Gridscan?")
        assert no_general_phrases(t)
        for bad in ["blockfrost", "koios", "cardanoscan", "maestro", "kupo", "ogmios"]:
            assert bad not in t, f"mentioned external service: {bad}"
