# gridscan_agent — Cardano API Agent Module
#
# A standalone, pip-installable module that gives an AI model
# (Anthropic Claude) tool-calling access to all 90 Gridscan / Cardano
# API endpoints.  The model picks which endpoint(s) to call, gets raw
# JSON back, and answers the user using real data.
#
# Quick start:
#   from gridscan_agent import GridscanAgent
#   agent = GridscanAgent(anthropic_api_key="sk-...", gridscan_api_key="...")
#   reply = await agent.chat("session-1", "Show me the latest block")

from gridscan_agent.agent import GridscanAgent
from gridscan_agent.config import AgentConfig
from gridscan_agent.context import ConversationContext
from gridscan_agent.api_client import GridscanAPIClient
from gridscan_agent.spec_loader import load_openapi_spec, build_tool_definitions

__all__ = [
    "GridscanAgent",
    "AgentConfig",
    "ConversationContext",
    "GridscanAPIClient",
    "load_openapi_spec",
    "build_tool_definitions",
]

__version__ = "1.0.0"
