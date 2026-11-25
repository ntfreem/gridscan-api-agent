"""/raw returns the complete API response even when it is over the model's 50,000-character cap.

Before the fix, an oversized response was cut for the model, no longer parsed, and was stored
without an "endpoint" key, so building the /raw reply raised KeyError: 'endpoint' (HTTP 500)."""
import asyncio
import json
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from gridscan_agent import agent as agent_mod  # noqa: E402
from gridscan_agent.agent import GridscanAgent  # noqa: E402

BIG = [{"tx_hash": f"{i:064x}", "json_metadata": {"name": "x" * 400}} for i in range(400)]   # ~190,000 characters
TOOL = {"name": "metadata_txs", "description": "d", "input_schema": {"type": "object", "properties": {}}}


class FakeAPI:
    def __init__(self):
        self.call_log = []

    async def call_tool(self, tool_def, arguments):
        self.call_log.append({"endpoint": "GET /api/metadata/txs/labels/721", "status": 200, "duration_ms": 1, "success": True})
        return {"success": True, "status_code": 200, "data": BIG}

    async def close(self):
        pass


def _completion_script():
    """First model turn calls the tool; the second answers."""
    calls = {"n": 0}

    def completion(**params):
        calls["n"] += 1
        if calls["n"] == 1:
            tc = SimpleNamespace(id="t1", function=SimpleNamespace(name="metadata_txs", arguments="{}"))
            msg = SimpleNamespace(tool_calls=[tc], content="")
        else:
            # The model only ever saw the capped copy.
            seen = params["messages"][-1]["content"]
            assert len(seen) <= 50000 + 20 and seen.endswith("... (truncated)")
            msg = SimpleNamespace(tool_calls=None, content="done")
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)], usage=None)
    return completion


def _agent():
    a = GridscanAgent(anthropic_api_key="test", gridscan_api_key="test")
    a._api = FakeAPI()
    a._tools = [TOOL]
    a._tool_map = {"metadata_txs": TOOL}
    a._tools_openai_format = [{"type": "function", "function": {"name": "metadata_txs", "description": "d", "parameters": TOOL["input_schema"]}}]
    a._initialized = True
    return a


def test_raw_returns_complete_payload_over_the_model_cap(monkeypatch):
    monkeypatch.setattr(agent_mod.litellm, "completion", _completion_script())
    result = asyncio.run(_agent().chat("s1", "/raw show label 721 transactions"))
    assert len(json.dumps(BIG, indent=2)) > 50000
    raw = result["raw_json"]
    assert len(raw) == 1 and raw[0]["endpoint"] == "GET /api/metadata/txs/labels/721"
    assert raw[0]["data"] == BIG                                     # complete, still JSON
    assert json.loads(result["reply"].split("```json\n", 1)[1].rsplit("\n```", 1)[0]) == BIG
