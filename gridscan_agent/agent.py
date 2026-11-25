"""
Main agent orchestrator.

Ties together the AI model, tool definitions, API client,
and conversation context into a single chat() interface.

Supports two backends:
  1. Emergent universal key (EMERGENT_LLM_KEY) — via litellm proxy
  2. Raw Anthropic SDK (ANTHROPIC_API_KEY) — for standalone/exported usage
"""
import json
import logging
import os
from typing import Any

import litellm

from gridscan_agent.config import AgentConfig
from gridscan_agent.spec_loader import load_openapi_spec, build_tool_definitions
from gridscan_agent.api_client import GridscanAPIClient
from gridscan_agent.context import ConversationContext

logger = logging.getLogger("gridscan_agent")


def _get_emergent_proxy_url():
    """Get the Emergent integration proxy URL."""
    try:
        from emergentintegrations.llm.chat import get_integration_proxy_url
        return get_integration_proxy_url()
    except Exception:
        return os.environ.get("INTEGRATION_PROXY_URL", "")


class GridscanAgent:
    """
    Cardano blockchain AI agent backed by the Gridscan API.

    The model receives all API endpoints as tools, picks which to call,
    gets raw JSON back, and answers the user using real data.

    Usage:
        agent = GridscanAgent(
            anthropic_api_key="sk-...",       # OR set ANTHROPIC_API_KEY env
            gridscan_api_key="your-key",      # OR set GRIDSCAN_API_KEY env
        )
        await agent.initialize()
        result = await agent.chat("session-1", "Show me the latest block")
        print(result["reply"])
    """

    def __init__(
        self,
        anthropic_api_key: str = "",
        gridscan_api_key: str = "",
        emergent_llm_key: str = "",
        config: AgentConfig | None = None,
    ):
        self.config = config or AgentConfig()
        if anthropic_api_key:
            self.config.anthropic_api_key = anthropic_api_key
        if gridscan_api_key:
            self.config.gridscan_api_key = gridscan_api_key

        # Resolve keys from env
        if not self.config.anthropic_api_key:
            self.config.anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not self.config.gridscan_api_key:
            self.config.gridscan_api_key = os.environ.get("GRIDSCAN_API_KEY", "")

        self._emergent_key = emergent_llm_key or os.environ.get("EMERGENT_LLM_KEY", "")
        self._use_emergent = bool(self._emergent_key) and not self.config.anthropic_api_key

        self._api = GridscanAPIClient(
            base_url=self.config.gridscan_base_url,
            api_key=self.config.gridscan_api_key,
            timeout=self.config.request_timeout,
            max_per_minute=self.config.max_requests_per_minute,
        )
        self._context = ConversationContext(max_messages=self.config.max_context_messages)
        self._tools: list[dict] = []
        self._tools_openai_format: list[dict] = []  # OpenAI function-calling format (works cross-provider via litellm)
        self._tools_anthropic_format: list[dict] = []  # Native Anthropic format
        self._tool_map: dict[str, dict] = {}
        self._initialized = False

    async def initialize(self):
        """Load the OpenAPI spec and build tool definitions. Call once."""
        if self._initialized:
            return

        logger.info(f"Loading OpenAPI spec from {self.config.openapi_spec_url}")
        spec = load_openapi_spec(self.config.openapi_spec_url)

        self._tools = build_tool_definitions(
            spec,
            excluded_operations=self.config.excluded_endpoints,
            included_tags=self.config.included_tags,
        )

        for tool in self._tools:
            self._tool_map[tool["name"]] = tool
            # OpenAI function-calling format (used by litellm)
            self._tools_openai_format.append({
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["input_schema"],
                },
            })
            # Native Anthropic format
            self._tools_anthropic_format.append({
                "name": tool["name"],
                "description": tool["description"],
                "input_schema": tool["input_schema"],
            })

        self._initialized = True
        backend = "emergent/litellm" if self._use_emergent else "anthropic SDK"
        logger.info(f"Loaded {len(self._tools)} tools | LLM backend: {backend}")

    def _build_system_prompt(self, session_id: str) -> str:
        base = self.config.system_prompt
        memory = self._context.get_memory(session_id)
        ctx_summary = memory.get_context_summary()
        return f"{base}\n\n## Current Session Context\n{ctx_summary}"

    def _build_litellm_params(self, messages: list, system_prompt: str) -> dict:
        """Build the litellm.completion() params for either Emergent or raw Anthropic."""
        # Prepend system message
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        params = {
            "messages": full_messages,
            "tools": self._tools_openai_format,
            "tool_choice": "auto",
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
        }

        if self._use_emergent:
            proxy_url = _get_emergent_proxy_url()
            params["model"] = self.config.model
            params["api_key"] = self._emergent_key
            params["api_base"] = proxy_url + "/llm"
            params["custom_llm_provider"] = "openai"
        else:
            params["model"] = f"anthropic/{self.config.model}"
            params["api_key"] = self.config.anthropic_api_key

        return params

    async def _execute_tool(self, tool_name: str, arguments: dict | str) -> str:
        """Execute a single tool call and return the result string."""
        tool_def = self._tool_map.get(tool_name)
        if not tool_def:
            return json.dumps({"error": True, "message": f"Unknown tool: {tool_name}"})

        # Arguments might be a JSON string
        if isinstance(arguments, str):
            try:
                arguments = json.loads(arguments)
            except json.JSONDecodeError:
                arguments = {}

        logger.info(f"Tool call: {tool_name}({json.dumps(arguments)[:200]})")
        result = await self._api.call_tool(tool_def, arguments)

        if result["success"]:
            result_text = json.dumps(result["data"], indent=2, default=str)
        else:
            result_text = json.dumps({
                "error": True,
                "status_code": result["status_code"],
                "message": result["data"],
            }, indent=2)

        # Cap response size
        if len(result_text) > 50000:
            result_text = result_text[:50000] + "\n... (truncated)"

        return result_text

    async def chat(self, session_id: str, user_message: str) -> dict[str, Any]:
        """
        Process a user message and return the agent's response.

        Commands:
            /raw <query>  — returns complete unformatted JSON from API calls
            /tools        — lists all available tool names

        Returns:
            {
                "reply": str,
                "tool_calls": list,
                "session_id": str,
                "tokens_used": dict,
                "raw_json": list | None,   # populated when /raw is used
            }
        """
        if not self._initialized:
            await self.initialize()

        # --- Handle /tools command ---
        stripped = user_message.strip()
        if stripped.lower() == "/tools":
            by_tag: dict[str, list] = {}
            for t in self._tools:
                tag = t.get("_tags", ["Other"])[0] if t.get("_tags") else "Other"
                by_tag.setdefault(tag, []).append(t["name"])
            lines = [f"**{len(self._tools)} available endpoints:**\n"]
            for tag in sorted(by_tag):
                lines.append(f"\n**{tag}** ({len(by_tag[tag])})")
                for name in by_tag[tag]:
                    lines.append(f"  `{name}`")
            return {
                "reply": "\n".join(lines),
                "tool_calls": [],
                "session_id": session_id,
                "tokens_used": {"input": 0, "output": 0},
                "raw_json": None,
            }

        # --- Handle /raw command ---
        raw_mode = False
        actual_message = stripped
        if stripped.lower().startswith("/raw"):
            raw_mode = True
            actual_message = stripped[4:].strip()
            if not actual_message:
                return {
                    "reply": "Usage: `/raw <your question>`\nExample: `/raw show me the latest block`",
                    "tool_calls": [],
                    "session_id": session_id,
                    "tokens_used": {"input": 0, "output": 0},
                    "raw_json": None,
                }

        self._context.add_user_message(session_id, actual_message)
        system_prompt = self._build_system_prompt(session_id)
        if raw_mode:
            system_prompt += "\n\nIMPORTANT: The user wants RAW JSON output. After calling the API, return the COMPLETE unformatted JSON response in a code block. Do NOT summarize, do NOT omit any fields, do NOT add commentary. Just the raw JSON."

        tool_calls_made = []
        raw_json_responses = [] if raw_mode else None
        total_input_tokens = 0
        total_output_tokens = 0

        # Build messages in OpenAI format for litellm
        raw_messages = self._context.get_messages(session_id)
        # Convert to plain OpenAI format
        oai_messages = []
        for msg in raw_messages:
            if msg["role"] == "user":
                if isinstance(msg["content"], str):
                    oai_messages.append({"role": "user", "content": msg["content"]})
                elif isinstance(msg["content"], list):
                    # Tool results — convert to OpenAI tool message format
                    for item in msg["content"]:
                        if isinstance(item, dict) and item.get("type") == "tool_result":
                            oai_messages.append({
                                "role": "tool",
                                "tool_call_id": item["tool_use_id"],
                                "content": item["content"],
                            })
            elif msg["role"] == "assistant":
                if isinstance(msg["content"], str):
                    oai_messages.append({"role": "assistant", "content": msg["content"]})
                elif isinstance(msg["content"], list):
                    # Assistant message with tool calls
                    tool_calls_in_msg = []
                    text_parts = []
                    for block in msg["content"]:
                        if hasattr(block, "type") and block.type == "tool_use":
                            tool_calls_in_msg.append({
                                "id": block.id,
                                "type": "function",
                                "function": {
                                    "name": block.name,
                                    "arguments": json.dumps(block.input),
                                },
                            })
                        elif hasattr(block, "text"):
                            text_parts.append(block.text)
                    am = {"role": "assistant", "content": "\n".join(text_parts) if text_parts else None}
                    if tool_calls_in_msg:
                        am["tool_calls"] = tool_calls_in_msg
                    oai_messages.append(am)

        for iteration in range(self.config.max_tool_calls_per_turn + 1):
            params = self._build_litellm_params(oai_messages, system_prompt)

            try:
                response = litellm.completion(**params)
            except Exception as e:
                logger.error(f"LLM call failed: {e}")
                return {
                    "reply": f"LLM error: {str(e)}",
                    "tool_calls": tool_calls_made,
                    "session_id": session_id,
                    "tokens_used": {"input": total_input_tokens, "output": total_output_tokens},
                    "raw_json": raw_json_responses,
                }

            # Token usage
            if hasattr(response, "usage") and response.usage:
                total_input_tokens += getattr(response.usage, "prompt_tokens", 0)
                total_output_tokens += getattr(response.usage, "completion_tokens", 0)

            choice = response.choices[0]
            message = choice.message

            # Check for tool calls
            if message.tool_calls:
                # Add assistant message with tool calls to conversation
                assistant_msg = {
                    "role": "assistant",
                    "content": message.content or "",
                    "tool_calls": [{
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    } for tc in message.tool_calls],
                }
                oai_messages.append(assistant_msg)

                # Execute each tool call
                for tc in message.tool_calls:
                    tool_name = tc.function.name
                    try:
                        args = json.loads(tc.function.arguments) if isinstance(tc.function.arguments, str) else tc.function.arguments
                    except json.JSONDecodeError:
                        args = {}

                    result_text = await self._execute_tool(tool_name, args)
                    tool_calls_made.append({
                        "tool": tool_name,
                        "endpoint": self._api.call_log[-1].get("endpoint", "?") if self._api.call_log else tool_name,
                        "status_code": self._api.call_log[-1].get("status", 0) if self._api.call_log else 0,
                        "duration_ms": self._api.call_log[-1].get("duration_ms", 0) if self._api.call_log else 0,
                        "success": self._api.call_log[-1].get("success", False) if self._api.call_log else False,
                        "arguments": args,
                    })

                    # Capture raw JSON for /raw mode
                    if raw_mode:
                        try:
                            raw_json_responses.append({
                                "tool": tool_name,
                                "endpoint": self._api.call_log[-1].get("endpoint", "?") if self._api.call_log else tool_name,
                                "data": json.loads(result_text) if isinstance(result_text, str) else result_text,
                            })
                        except json.JSONDecodeError:
                            raw_json_responses.append({"tool": tool_name, "data": result_text})

                    # Add tool result
                    oai_messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result_text,
                    })

                # Continue loop for next LLM call
                continue

            else:
                # No tool calls — final response
                reply_text = message.content or "(no response)"

                # In raw mode, override the reply with the actual raw JSON
                if raw_mode and raw_json_responses:
                    json_blocks = []
                    for rj in raw_json_responses:
                        json_blocks.append(f"**{rj['endpoint']}**\n```json\n{json.dumps(rj['data'], indent=2, default=str)}\n```")
                    reply_text = "\n\n".join(json_blocks)

                self._context.add_assistant_message(session_id, reply_text)
                return {
                    "reply": reply_text,
                    "tool_calls": tool_calls_made,
                    "session_id": session_id,
                    "tokens_used": {"input": total_input_tokens, "output": total_output_tokens},
                    "raw_json": raw_json_responses,
                }

        return {
            "reply": "I made several API calls but couldn't complete the analysis. Try a more specific question.",
            "tool_calls": tool_calls_made,
            "session_id": session_id,
            "tokens_used": {"input": total_input_tokens, "output": total_output_tokens},
            "raw_json": raw_json_responses,
        }

    # --- Utility methods ---

    @property
    def tool_count(self) -> int:
        return len(self._tools)

    @property
    def tool_names(self) -> list[str]:
        return [t["name"] for t in self._tools]

    @property
    def api_call_log(self) -> list[dict]:
        return self._api.call_log

    @property
    def api_analytics(self) -> dict:
        """Get aggregated analytics across all API calls."""
        return self._api.get_analytics()

    @property
    def backend_type(self) -> str:
        return "emergent/litellm" if self._use_emergent else "anthropic"

    def get_session_memory(self, session_id: str) -> dict:
        mem = self._context.get_memory(session_id)
        return {
            "stake_addresses": mem.stake_addresses,
            "payment_addresses": mem.payment_addresses,
            "pool_ids": mem.pool_ids,
            "tx_hashes": mem.tx_hashes,
            "drep_ids": mem.drep_ids,
            "asset_units": mem.asset_units,
            "epochs": mem.epochs,
            "block_numbers": mem.block_numbers,
            "last_entity": {"type": mem.last_entity_type, "value": mem.last_entity_value},
        }

    def clear_session(self, session_id: str):
        self._context.clear_session(session_id)

    def list_sessions(self) -> list[str]:
        return self._context.list_sessions()

    async def close(self):
        await self._api.close()
