"""Full identifiers from API results survive to the next message.

Reproduces the reported conversation: a pasted address, then "show me all inputs for tx ending 92b".
The agent's reply only showed the hash shortened (43ab5bc9...7d6192b), and tool results aren't kept
between messages, so the agent had no full hash and guessed one (404/400)."""
import asyncio
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from gridscan_agent import agent as agent_mod  # noqa: E402
from gridscan_agent.agent import GridscanAgent  # noqa: E402
from gridscan_agent.context import ConversationContext, find_partial_references  # noqa: E402

ADDR = "addr1qxnfu7yefr2lfdcy5gaxfptvlvzhd5wjxf9t7ezhnrldte6c0pmud52qw72qev3v288350ydkz2yjjar9sej03uzvfss5td45t"
TX = "43ab5bc909cfa98cdd361d7575ccc6549b2bb96ccd2289bc66238877b7d6192b"
OTHER = [f"{i:063x}a" for i in range(1, 30)]          # 29 other tx hashes, none ending in 92b
BLOCK = "b" * 64
TXS = [{"tx_hash": h, "block_hash": BLOCK, "block_height": 100 + i} for i, h in enumerate(OTHER[:12] + [TX] + OTHER[12:])]
UTXOS = {"hash": TX, "inputs": [{"address": ADDR, "amount": [{"unit": "lovelace", "quantity": "5000000"}]}], "outputs": []}

TOOLS = {n: {"name": n, "description": "d", "input_schema": {"type": "object", "properties": {}}}
         for n in ("address_transactions", "tx_utxos")}


class FakeAPI:
    def __init__(self):
        self.call_log = []

    async def call_tool(self, tool_def, arguments):
        name = tool_def["name"]
        if name == "address_transactions":
            ok, data, ep = True, TXS, f"GET /api/addresses/{arguments.get('address')}/transactions"
        elif arguments.get("hash") == TX:
            ok, data, ep = True, UTXOS, f"GET /api/txs/{TX}/utxos"
        else:
            ok, data, ep = False, "Not found", f"GET /api/txs/{arguments.get('hash')}/utxos"
        self.call_log.append({"endpoint": ep, "status": 200 if ok else 404, "duration_ms": 1, "success": ok})
        return {"success": ok, "status_code": 200 if ok else 404, "data": data}

    async def close(self):
        pass


def _agent():
    a = GridscanAgent(anthropic_api_key="test", gridscan_api_key="test")
    a._api = FakeAPI()
    a._tools = list(TOOLS.values())
    a._tool_map = dict(TOOLS)
    a._tools_openai_format = [{"type": "function", "function": {"name": n, "description": "d", "parameters": t["input_schema"]}}
                              for n, t in TOOLS.items()]
    a._initialized = True
    return a


def _tool_turn(name, args):
    import json
    tc = SimpleNamespace(id="t1", function=SimpleNamespace(name=name, arguments=json.dumps(args)))
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(tool_calls=[tc], content=""))], usage=None)


def _text(t):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(tool_calls=None, content=t))], usage=None)


def test_tx_ending_92b_resolves_to_the_full_hash_from_an_earlier_api_result(monkeypatch):
    seen_prompts = []
    script = [
        _tool_turn("address_transactions", {"address": ADDR}),
        # The model's own reply shortens the hash, like the reported run.
        _text("Recent transactions:\n- 43ab5bc9...7d6192b (block 112)"),
        None,   # second message: the model reads the resolved hash from the system prompt
        _text("Inputs: 5 ADA from the address."),
    ]

    def completion(**params):
        seen_prompts.append(params["messages"][0]["content"])
        step = script.pop(0)
        if step is None:
            system = params["messages"][0]["content"]
            assert f'"ending 92b" is hash {TX} (from tx_hash from address_transactions). Use this full value.' in system
            return _tool_turn("tx_utxos", {"hash": TX})
        return step

    monkeypatch.setattr(agent_mod.litellm, "completion", completion)
    a = _agent()
    asyncio.run(a.chat("s1", ADDR))
    result = asyncio.run(a.chat("s1", "show me all inputs for tx ending 92b"))
    assert [c["tool"] for c in result["tool_calls"]] == ["tx_utxos"]
    assert result["tool_calls"][0]["arguments"] == {"hash": TX} and result["tool_calls"][0]["success"]
    # The hash looked up is now the last referenced entity ("that transaction").
    assert a.get_session_memory("s1")["last_entity"] == {"type": "tx_hash", "value": TX}
    # Rules for the model: never guess, write identifiers in full.
    assert "NEVER invent, guess or complete an identifier" in seen_prompts[0]
    assert "Never shorten them" in seen_prompts[0]


def test_shortened_form_from_the_reply_also_resolves():
    ctx = ConversationContext()
    ctx.remember_api_result("s", "address_transactions", {"address": ADDR}, TXS)
    for text in ("details of 43ab5bc9...7d6192b", "details of 43ab5bc9…7d6192b", "the one starting with 43ab5bc9",
                 "tx ending in 7d6192b"):
        [r] = ctx.resolve_partial_references("s", text)
        assert [m["value"] for m in r["matches"]] == [TX], text


def test_unknown_fragment_tells_the_model_not_to_guess(monkeypatch):
    a = _agent()
    note = a._partial_reference_note("fresh", "show me all inputs for tx ending 92b")
    assert "matches nothing remembered" in note and "Do not guess" in note


def test_ambiguous_fragment_lists_candidates():
    ctx = ConversationContext()
    ctx.remember_api_result("s", "address_transactions", {}, TXS)
    [r] = ctx.resolve_partial_references("s", "the tx starting with 0000")
    assert len(r["matches"]) > 1


def test_failed_calls_are_not_remembered(monkeypatch):
    script = [_tool_turn("tx_utxos", {"hash": "c" * 64}), _text("not found")]
    monkeypatch.setattr(agent_mod.litellm, "completion", lambda **p: script.pop(0))
    a = _agent()
    asyncio.run(a.chat("s2", "inputs please"))
    mem = a.get_session_memory("s2")
    assert "c" * 64 not in mem["tx_hashes"] and not a._context.get_memory("s2").seen


def test_all_api_identifiers_are_kept_in_full_and_prompt_lists_them_in_full():
    ctx = ConversationContext()
    ctx.remember_api_result("s", "address_transactions", {"address": ADDR}, TXS)
    mem = ctx.get_memory("s")
    assert {v for v, _k, _l in mem.seen} >= set(OTHER) | {TX, BLOCK}
    summary = mem.get_context_summary()
    assert TX in summary and ADDR in summary and "..." not in summary


def test_plain_words_are_not_partial_identifiers():
    assert find_partial_references("the story ending soon, starting with hello") == []
    assert find_partial_references("wait... what") == []
