# Gridscan Agent

A standalone Python module that gives Anthropic Claude **tool-calling access to all 90 Cardano/Gridscan API endpoints**.  The model picks which endpoint(s) to call, gets raw JSON back, and answers users with real blockchain data.

## Features

- **Full API coverage** — all 90 endpoints (accounts, addresses, pools, epochs, transactions, assets, blocks, metadata, governance, network) loaded dynamically from the OpenAPI spec
- **Anthropic native tool-calling** — Claude sees every endpoint as a tool, picks the right one(s), chains calls when needed
- **Raw JSON passthrough** — when users ask "show me the JSON", they get the exact API response
- **Conversation memory** — remembers addresses, tx hashes, pool IDs across messages so "show me details of that" works
- **Rate limiting** — built-in token-bucket rate limiter respects API limits
- **Audit log** — every API call is logged with endpoint, status, and timing
- **Test CLI + Web UI** — interactive testing without integrating into your app first
- **pip-installable** — drop it into any Python project

## Quick Start

### 1. Install

```bash
pip install -r requirements.txt
# or
pip install gridscan-agent
```

### 2. Set environment variables

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export GRIDSCAN_API_KEY=your-gridscan-key  # optional for demo tier
```

### 3. Use in your code

```python
import asyncio
from gridscan_agent import GridscanAgent

async def main():
    agent = GridscanAgent(
        anthropic_api_key="sk-ant-...",
        gridscan_api_key="your-key",
    )
    await agent.initialize()

    # Single message
    result = await agent.chat("session-1", "Show me the latest block")
    print(result["reply"])
    print(f"API calls made: {len(result['tool_calls'])}")

    # Follow-up with context
    result = await agent.chat("session-1", "What transactions are in it?")
    print(result["reply"])

    await agent.close()

asyncio.run(main())
```

### 4. Test with the CLI

```bash
python -m gridscan_agent.test_cli
```

Commands: `tools` (list all), `memory` (see context), `log` (API call history), `clear` (reset session), `quit`.

### 5. Test with the Web UI

```bash
python -m gridscan_agent.test_server
# Open http://localhost:8099
```

## Integration with BitBot Pro

```python
# In your bot's message handler:
from gridscan_agent import GridscanAgent

agent = GridscanAgent(
    anthropic_api_key=os.environ["ANTHROPIC_API_KEY"],
    gridscan_api_key=os.environ["GRIDSCAN_API_KEY"],
)
await agent.initialize()

# Per-message:
async def handle_message(channel_id: str, user_message: str):
    result = await agent.chat(
        session_id=channel_id,  # or user_id for per-user context
        user_message=user_message,
    )
    return result["reply"]  # Send this back to Discord/Telegram/Webchat
```

## Integration with any FastAPI app

```python
from fastapi import FastAPI
from gridscan_agent import GridscanAgent

app = FastAPI()
agent = GridscanAgent(...)

@app.on_event("startup")
async def startup():
    await agent.initialize()

@app.post("/chat")
async def chat(message: str, session_id: str = "default"):
    result = await agent.chat(session_id, message)
    return result
```

## Configuration

```python
from gridscan_agent import AgentConfig

config = AgentConfig(
    anthropic_api_key="sk-...",
    gridscan_api_key="your-key",
    model="claude-sonnet-4-20250514",       # any Anthropic model
    max_tokens=4096,                   # response length
    temperature=0.1,                   # low for factual data
    max_requests_per_minute=50,        # API rate limit
    max_context_messages=20,           # history per session
    max_tool_calls_per_turn=5,         # prevent runaway loops
    raw_json_passthrough=True,         # let model show raw JSON
)

agent = GridscanAgent(config=config)
```

## API Endpoints (Test Server)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Send a message, get agent response |
| GET | `/api/tools` | List all available tools |
| GET | `/api/sessions` | List active sessions |
| GET | `/api/sessions/{id}/memory` | Get session memory |
| DELETE | `/api/sessions/{id}` | Clear a session |
| GET | `/api/log` | API call audit log |
| GET | `/api/health` | Health check |
| GET | `/` | Web test UI |

## Architecture

```
gridscan_agent/
├── __init__.py          # Public API
├── agent.py             # Main orchestrator (model + tools + context)
├── spec_loader.py       # OpenAPI spec → Anthropic tool definitions
├── api_client.py        # HTTP client with auth & rate limiting
├── context.py           # Conversation memory (addresses, hashes, etc.)
├── config.py            # Configuration
├── test_cli.py          # Interactive CLI tester
├── test_server.py       # FastAPI test server with web UI
├── setup.py             # pip install support
├── requirements.txt     # Dependencies
└── README.md            # This file
```

## How It Works

1. **Spec Loading**: Fetches the OpenAPI spec from `ada.api.gridscan.io` and converts all 90 endpoints into Anthropic tool definitions
2. **Tool Selection**: Claude receives the full tool list and picks which endpoint(s) to call based on the user's question
3. **API Execution**: The client makes the actual HTTP call with proper auth, path params, and query params
4. **Raw JSON**: The complete API response (JSON) is passed back to Claude as tool results
5. **Answer**: Claude formulates its answer using the real data, can chain multiple calls per turn
6. **Memory**: Cardano identifiers (addresses, hashes, pool IDs) are extracted and remembered for follow-up questions

## License

MIT
