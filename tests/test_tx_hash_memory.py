"""Transaction hashes are remembered, "that transaction" stays the one last asked or looked up,
and identifiers the model shortened are written in full when the session knows which one it is.

Reproduces a live run: after "show me all inputs for tx ending 92b" (looked up 43ab…92b), the
agent's reply mentioned the stake address last, which became the "last referenced entity"; tx
hashes were never stored ("tx_hashs"), so "show me the details of that transaction" looked up a
different transaction."""
import asyncio
import json
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from gridscan_agent import agent as agent_mod  # noqa: E402
from gridscan_agent.agent import GridscanAgent  # noqa: E402
from gridscan_agent.context import ConversationContext  # noqa: E402

ADDR = "addr1qxnfu7yefr2lfdcy5gaxfptvlvzhd5wjxf9t7ezhnrldte6c0pmud52qw72qev3v288350ydkz2yjjar9sej03uzvfss5td45t"
STAKE = "stake1u9v8sa7x69q809qvkgk9rnc68jxmp9zffw3jcve8c7pxycgdecshn"
TX = "43ab5bc909cfa98cdd361d7575ccc6549b2bb96ccd2289bc66238877b7d6192b"
OTHER_TX = "ed3551406390aa0fd4787e4fe2845b70a5957e692f8be3d5ec243bfc837ae125"
SOURCE = "62563c3b03fae267b749c6aab2823664b0ef119539e4d6af8194d8743c376dea"
UTXOS = {"hash": TX, "inputs": [{"address": ADDR, "tx_hash": SOURCE, "output_index": 1, "stake_address": STAKE}]}
TOOLS = {n: {"name": n, "description": "d", "input_schema": {"type": "object", "properties": {}}} for n in ("tx_utxos", "tx_info")}


class FakeAPI:
    def __init__(self):
        self.call_log = []

    async def call_tool(self, tool_def, arguments):
        self.call_log.append({"endpoint": f"GET /api/txs/{arguments.get('hash')}", "status": 200, "duration_ms": 1, "success": True})
        return {"success": True, "status_code": 200, "data": UTXOS}

    async def close(self):
        pass


def _agent():
    a = GridscanAgent(anthropic_api_key="test", gridscan_api_key="test")
    a._api = FakeAPI()
    a._tools = list(TOOLS.values())
    a._tool_map = dict(TOOLS)
    a._tools_openai_format = [{"type": "function", "function": {"name": n, "description": "d", "parameters": t["input_schema"]}} for n, t in TOOLS.items()]
    a._initialized = True
    return a


def _tool_turn(name, args):
    tc = SimpleNamespace(id="t1", function=SimpleNamespace(name=name, arguments=json.dumps(args)))
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(tool_calls=[tc], content=""))], usage=None)


def _text(t):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(tool_calls=None, content=t))], usage=None)


def test_tx_hashes_are_remembered():
    ctx = ConversationContext()
    ctx.add_user_message("s", f"look up {TX}")
    m = ctx.get_memory("s")
    assert m.tx_hashes == [TX] and (m.last_entity_type, m.last_entity_value) == ("tx_hash", TX)
    assert f"Remembered tx hashes: {TX}" in m.get_context_summary()
    for kind, attr in (("pool_id", "pool_ids"), ("drep_id", "drep_ids"), ("asset_unit", "asset_units"), ("epoch", "epochs"),
                       ("block_number", "block_numbers"), ("stake_address", "stake_addresses"), ("payment_address", "payment_addresses")):
        m.add(kind, "x" if kind not in ("epoch", "block_number") else 1)
        assert getattr(m, attr)[0] in ("x", 1), kind


def test_that_transaction_is_the_one_looked_up_not_the_last_thing_the_reply_mentioned(monkeypatch):
    replies = [_tool_turn("tx_utxos", {"hash": TX}),
               _text(f"Inputs of `{TX}`: 1 input from `{ADDR}`, source tx `{OTHER_TX}`, stake address `{STAKE}`.")]
    monkeypatch.setattr(agent_mod.litellm, "completion", lambda **p: replies.pop(0))
    a = _agent()
    asyncio.run(a.chat("s", "show me all inputs for tx ending 92b"))
    mem = a.get_session_memory("s")
    assert mem["last_entity"] == {"type": "tx_hash", "value": TX}
    assert TX in mem["tx_hashes"] and STAKE in mem["stake_addresses"]      # still remembered, just not "last"


def test_a_message_naming_an_identifier_still_sets_the_last_entity():
    ctx = ConversationContext()
    ctx.add_assistant_message("s", f"see `{OTHER_TX}`")
    ctx.add_user_message("s", f"what about {STAKE}?")
    m = ctx.get_memory("s")
    assert (m.last_entity_type, m.last_entity_value) == ("stake_address", STAKE)


def test_shortened_identifiers_in_the_reply_are_written_in_full(monkeypatch):
    replies = [_tool_turn("tx_utxos", {"hash": TX}),
               _text("Inputs for `43ab5bc9...7d6192b`: `addr1qxnfu7...5td45t`, source `62563c3b…376dea`, unknown `deadbeef...cafe12`.")]
    monkeypatch.setattr(agent_mod.litellm, "completion", lambda **p: replies.pop(0))
    a = _agent()
    reply = asyncio.run(a.chat("s", "show me all inputs for tx ending 92b"))["reply"]
    assert f"`{TX}`" in reply and f"`{ADDR}`" in reply and f"`{SOURCE}`" in reply
    assert "deadbeef...cafe12" in reply                                      # unknown: left as written


def test_ambiguous_shortened_form_is_left_alone():
    ctx = ConversationContext()
    a, b = "aaaa" + "0" * 57 + "abc", "aaaa" + "1" * 57 + "abc"
    ctx.remember_api_result("s", "t", {}, [a, b])
    assert ctx.expand_shortened("s", "tx aaaa...abc") == "tx aaaa...abc"


def test_raw_json_is_not_rewritten(monkeypatch):
    replies = [_tool_turn("tx_utxos", {"hash": TX}), _text("ignored")]
    monkeypatch.setattr(agent_mod.litellm, "completion", lambda **p: replies.pop(0))
    raw = asyncio.run(_agent().chat("s", "/raw inputs of 43ab5bc9...7d6192b"))
    assert json.loads(raw["reply"].split("```json\n", 1)[1].rsplit("\n```", 1)[0]) == UTXOS
