"""
FastAPI test server for the Gridscan Agent.

Provides a REST API and a simple web UI to test the agent
without needing to integrate it into your main application.

Usage:
    uvicorn gridscan_agent.test_server:app --port 8099
    # or
    python -m gridscan_agent.test_server
"""
import os
import json
import uuid
import asyncio
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from gridscan_agent import GridscanAgent, AgentConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gridscan_agent.test_server")

app = FastAPI(
    title="Gridscan Agent Test Server",
    description="Test interface for the Cardano Gridscan AI Agent",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global agent instance — initialized on startup
_agent: GridscanAgent | None = None


@app.on_event("startup")
async def startup():
    global _agent
    config = AgentConfig(
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
        gridscan_api_key=os.environ.get("GRIDSCAN_API_KEY", ""),
        model=os.environ.get("AGENT_MODEL", "claude-sonnet-4-5-20250929"),
        gridscan_base_url=os.environ.get("GRIDSCAN_BASE_URL", "https://ada.api.gridscan.io"),
    )
    _agent = GridscanAgent(config=config)
    # Lazy init — tools loaded on first chat call
    logger.info("Agent created (tools load on first request)")


@app.on_event("shutdown")
async def shutdown():
    if _agent:
        await _agent.close()


# --- API Models ---

class ChatRequest(BaseModel):
    message: str
    session_id: str = ""

class ChatResponse(BaseModel):
    reply: str
    tool_calls: list
    session_id: str
    tokens_used: dict
    raw_json: list | None = None


# --- Endpoints ---

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Send a message to the agent and get a response."""
    if not _agent:
        raise HTTPException(500, "Agent not initialized")
    if not req.message.strip():
        raise HTTPException(400, "Message cannot be empty")

    session_id = req.session_id or str(uuid.uuid4())

    try:
        result = await _agent.chat(session_id, req.message)
        return ChatResponse(**result)
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@app.get("/api/tools")
async def list_tools():
    """List all available API tools."""
    if not _agent:
        raise HTTPException(500, "Agent not initialized")
    return {
        "count": _agent.tool_count,
        "tools": _agent.tool_names,
    }


@app.get("/api/sessions")
async def list_sessions():
    """List active sessions."""
    if not _agent:
        raise HTTPException(500, "Agent not initialized")
    return {"sessions": _agent.list_sessions()}


@app.get("/api/sessions/{session_id}/memory")
async def session_memory(session_id: str):
    """Get the memory state for a session."""
    if not _agent:
        raise HTTPException(500, "Agent not initialized")
    return _agent.get_session_memory(session_id)


@app.delete("/api/sessions/{session_id}")
async def clear_session(session_id: str):
    """Clear a session's history."""
    if not _agent:
        raise HTTPException(500, "Agent not initialized")
    _agent.clear_session(session_id)
    return {"cleared": True}


@app.get("/api/log")
async def api_call_log():
    """Get the API call audit log."""
    if not _agent:
        raise HTTPException(500, "Agent not initialized")
    return {"calls": _agent.api_call_log[-100:]}


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "tools_loaded": _agent.tool_count if _agent else 0,
        "initialized": _agent is not None and _agent._initialized,
    }


@app.get("/api/analytics")
async def analytics():
    """Get endpoint usage analytics."""
    if not _agent:
        raise HTTPException(500, "Agent not initialized")
    return _agent.api_analytics


# --- Web Pages ---

@app.get("/", response_class=HTMLResponse)
async def test_ui():
    return TEST_UI_HTML


@app.get("/analytics", response_class=HTMLResponse)
async def analytics_dashboard():
    return ANALYTICS_HTML


TEST_UI_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Gridscan Agent Tester</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
    background: #0B0F19; color: #E2E8F0; min-height: 100vh;
  }
  .container { max-width: 900px; margin: 0 auto; padding: 20px; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  h1 { font-size: 20px; font-weight: 700; color: #60A5FA; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #64748B; }
  .nav-link { font-size: 11px; color: #3B82F6; text-decoration: none; padding: 6px 12px; border: 1px solid #1E3A5F; border-radius: 6px; transition: all 0.2s; }
  .nav-link:hover { background: #1E3A5F; color: #60A5FA; }
  .chat-box {
    background: #111827; border: 1px solid #1E293B; border-radius: 12px;
    height: 500px; overflow-y: auto; padding: 16px; margin-bottom: 12px;
  }
  .msg { margin-bottom: 12px; padding: 10px 14px; border-radius: 8px; font-size: 13px; line-height: 1.6; }
  .msg.user { background: #1E3A5F; border-left: 3px solid #3B82F6; }
  .msg.agent { background: #1A2332; border-left: 3px solid #34D399; }
  .msg.raw { background: #0F1A12; border-left: 3px solid #22C55E; }
  .msg.system { background: #1E1E2E; border-left: 3px solid #64748B; font-size: 11px; color: #94A3B8; }
  .msg pre { background: #0B0F19; padding: 8px 10px; border-radius: 6px; overflow-x: auto; margin: 6px 0; font-size: 11px; max-height: 400px; }
  .msg code { font-family: inherit; }
  .tool-call { font-size: 10px; color: #FBBF24; padding: 2px 0; }
  .tool-call.success { color: #34D399; }
  .tool-call.error { color: #F43F5E; }
  .input-row { display: flex; gap: 8px; }
  .input-row input {
    flex: 1; padding: 12px 16px; background: #111827; border: 1px solid #1E293B;
    border-radius: 8px; color: #E2E8F0; font-family: inherit; font-size: 13px;
    outline: none; transition: border-color 0.2s;
  }
  .input-row input:focus { border-color: #3B82F6; }
  .input-row button {
    padding: 12px 24px; background: #3B82F6; border: none; border-radius: 8px;
    color: white; font-family: inherit; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.2s;
  }
  .input-row button:hover { background: #2563EB; }
  .input-row button:disabled { background: #1E293B; color: #64748B; cursor: not-allowed; }
  .meta { display: flex; gap: 16px; margin-top: 10px; font-size: 10px; color: #64748B; }
  .meta span { display: flex; align-items: center; gap: 4px; }
  .commands { margin-top: 8px; font-size: 10px; color: #475569; }
  .commands code { color: #60A5FA; background: #1E293B; padding: 1px 5px; border-radius: 3px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <h1>Gridscan Agent Tester</h1>
      <p class="subtitle">Cardano blockchain data via AI tool-calling</p>
    </div>
    <a href="/analytics" class="nav-link">Endpoint Analytics</a>
  </div>
  <div class="chat-box" id="chat"></div>
  <div class="input-row">
    <input id="input" placeholder="Ask about Cardano... e.g. 'Show me the latest block'" autofocus
      onkeydown="if(event.key==='Enter')send()" />
    <button id="btn" onclick="send()">Send</button>
  </div>
  <div class="meta">
    <span id="tools">Loading tools...</span>
    <span id="session">Session: --</span>
    <span id="tokens">Tokens: --</span>
  </div>
  <div class="commands">
    Commands: <code>/raw &lt;query&gt;</code> complete unformatted JSON &nbsp;|&nbsp;
    <code>/tools</code> list all endpoints
  </div>
</div>
<script>
const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('input');
const btnEl = document.getElementById('btn');
let sessionId = 'test-' + Math.random().toString(36).slice(2, 8);
document.getElementById('session').textContent = 'Session: ' + sessionId;

fetch('/api/tools').then(r=>r.json()).then(d=>{
  document.getElementById('tools').textContent = d.count + ' tools loaded';
});

function addMsg(role, html) {
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  div.innerHTML = html;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatReply(text) {
  text = text.replace(/```json\\n([\\s\\S]*?)```/g, '<pre><code>$1</code></pre>');
  text = text.replace(/```([\\s\\S]*?)```/g, '<pre><code>$1</code></pre>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
  text = text.replace(/\\n/g, '<br>');
  return text;
}

async function send() {
  const msg = inputEl.value.trim();
  if (!msg) return;
  inputEl.value = '';
  btnEl.disabled = true;
  const isRaw = msg.toLowerCase().startsWith('/raw');

  addMsg('user', escHtml(msg));
  addMsg('system', 'Thinking...');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ message: msg, session_id: sessionId }),
    });
    chatEl.removeChild(chatEl.lastChild);

    if (!res.ok) {
      const err = await res.json().catch(()=>({detail:'Unknown error'}));
      addMsg('system', 'Error: ' + escHtml(err.detail || JSON.stringify(err)));
      return;
    }

    const data = await res.json();

    if (data.tool_calls && data.tool_calls.length) {
      let tcHtml = data.tool_calls.map(tc => {
        const cls = tc.success ? 'success' : 'error';
        return '<div class="tool-call ' + cls + '">' + escHtml(tc.endpoint) + ' -> ' + tc.status_code + ' (' + tc.duration_ms + 'ms)</div>';
      }).join('');
      addMsg('system', tcHtml);
    }

    // If raw mode and we have raw_json, show it directly
    if (isRaw && data.raw_json && data.raw_json.length) {
      data.raw_json.forEach(function(rj) {
        const jsonStr = JSON.stringify(rj.data, null, 2);
        addMsg('raw', '<strong>' + escHtml(rj.endpoint || rj.tool) + '</strong><pre><code>' + escHtml(jsonStr) + '</code></pre>');
      });
    } else {
      addMsg('agent', formatReply(escHtml(data.reply)));
    }

    if (data.tokens_used) {
      document.getElementById('tokens').textContent =
        'Tokens: ' + data.tokens_used.input + ' in / ' + data.tokens_used.output + ' out';
    }
  } catch(e) {
    chatEl.removeChild(chatEl.lastChild);
    addMsg('system', 'Error: ' + escHtml(e.message));
  } finally {
    btnEl.disabled = false;
    inputEl.focus();
  }
}
</script>
</body>
</html>
"""


ANALYTICS_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Endpoint Analytics — Gridscan Agent</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
    background: #0B0F19; color: #E2E8F0; min-height: 100vh;
  }
  .container { max-width: 1100px; margin: 0 auto; padding: 20px; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
  h1 { font-size: 20px; font-weight: 700; color: #60A5FA; }
  .subtitle { font-size: 12px; color: #64748B; margin-top: 2px; }
  .nav-link { font-size: 11px; color: #3B82F6; text-decoration: none; padding: 6px 12px; border: 1px solid #1E3A5F; border-radius: 6px; transition: all 0.2s; }
  .nav-link:hover { background: #1E3A5F; color: #60A5FA; }
  .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat-card {
    background: #111827; border: 1px solid #1E293B; border-radius: 10px; padding: 16px;
    text-align: center;
  }
  .stat-value { font-size: 28px; font-weight: 700; color: #E2E8F0; line-height: 1.2; }
  .stat-value.green { color: #34D399; }
  .stat-value.blue { color: #60A5FA; }
  .stat-value.yellow { color: #FBBF24; }
  .stat-value.red { color: #F43F5E; }
  .stat-label { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }
  .table-wrap {
    background: #111827; border: 1px solid #1E293B; border-radius: 10px;
    overflow: hidden;
  }
  .table-header { padding: 14px 18px; border-bottom: 1px solid #1E293B; display: flex; align-items: center; justify-content: space-between; }
  .table-header h2 { font-size: 14px; font-weight: 600; color: #E2E8F0; }
  .table-header .refresh { font-size: 10px; color: #3B82F6; cursor: pointer; border: none; background: none; font-family: inherit; }
  .table-header .refresh:hover { color: #60A5FA; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 10px 18px; font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #1E293B; }
  td { padding: 10px 18px; font-size: 12px; border-bottom: 1px solid rgba(30,41,59,0.5); }
  tr:hover { background: rgba(59,130,246,0.04); }
  .bar-wrap { width: 100%; height: 6px; background: #1E293B; border-radius: 3px; overflow: hidden; }
  .bar { height: 100%; border-radius: 3px; transition: width 0.5s; }
  .bar.ok { background: #34D399; }
  .bar.warn { background: #FBBF24; }
  .bar.err { background: #F43F5E; }
  .badge { display: inline-block; font-size: 9px; font-weight: 600; padding: 2px 7px; border-radius: 10px; }
  .badge.ok { color: #34D399; background: rgba(52,211,153,0.1); }
  .badge.warn { color: #FBBF24; background: rgba(251,191,36,0.1); }
  .badge.err { color: #F43F5E; background: rgba(244,63,94,0.1); }
  .empty { text-align: center; padding: 40px; color: #64748B; font-size: 13px; }
  .coverage-ring { width: 80px; height: 80px; margin: 0 auto; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <h1>Endpoint Analytics</h1>
      <p class="subtitle" id="subtitle">Loading...</p>
    </div>
    <a href="/" class="nav-link">Back to Chat</a>
  </div>

  <div class="stats-row" id="stats"></div>

  <div class="table-wrap">
    <div class="table-header">
      <h2>Endpoint Usage</h2>
      <button class="refresh" onclick="loadAnalytics()">Refresh</button>
    </div>
    <div id="table-body"></div>
  </div>
</div>

<script>
async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    const data = await res.json();
    renderStats(data);
    renderTable(data);
    document.getElementById('subtitle').textContent =
      data.total_calls + ' total calls across ' + data.unique_endpoints_used + ' of 89 endpoints';
  } catch(e) {
    document.getElementById('subtitle').textContent = 'Error loading analytics';
  }
}

function renderStats(data) {
  const el = document.getElementById('stats');
  el.innerHTML = `
    <div class="stat-card">
      <div class="stat-value blue">${data.total_calls}</div>
      <div class="stat-label">Total API Calls</div>
    </div>
    <div class="stat-card">
      <div class="stat-value green">${data.unique_endpoints_used}</div>
      <div class="stat-label">Endpoints Used</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${data.coverage_pct > 50 ? 'green' : data.coverage_pct > 20 ? 'yellow' : 'red'}">${data.coverage_pct}%</div>
      <div class="stat-label">Coverage</div>
    </div>
    <div class="stat-card">
      <div class="stat-value yellow">${data.avg_duration_ms}ms</div>
      <div class="stat-label">Avg Latency</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${data.error_rate > 10 ? 'red' : data.error_rate > 0 ? 'yellow' : 'green'}">${data.error_rate}%</div>
      <div class="stat-label">Error Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.total_errors}</div>
      <div class="stat-label">Total Errors</div>
    </div>
  `;
}

function renderTable(data) {
  const el = document.getElementById('table-body');
  const eps = data.endpoints;
  const keys = Object.keys(eps);

  if (!keys.length) {
    el.innerHTML = '<div class="empty">No API calls recorded yet. Start chatting to generate analytics.</div>';
    return;
  }

  const maxCalls = Math.max(...keys.map(k => eps[k].calls));

  let html = '<table><thead><tr>';
  html += '<th>Endpoint</th><th>Calls</th><th>Usage</th><th>Errors</th><th>Avg (ms)</th><th>Min</th><th>Max</th><th>Status</th>';
  html += '</tr></thead><tbody>';

  keys.forEach(function(name) {
    const ep = eps[name];
    const pct = Math.round(ep.calls / maxCalls * 100);
    const barCls = ep.error_rate > 20 ? 'err' : ep.error_rate > 0 ? 'warn' : 'ok';
    const badgeCls = ep.error_rate === 0 ? 'ok' : ep.error_rate < 20 ? 'warn' : 'err';
    const badgeText = ep.error_rate === 0 ? 'Healthy' : ep.error_rate + '% errors';

    html += '<tr>';
    html += '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + name + '">' + name + '</td>';
    html += '<td style="font-weight:600">' + ep.calls + '</td>';
    html += '<td style="width:120px"><div class="bar-wrap"><div class="bar ' + barCls + '" style="width:' + pct + '%"></div></div></td>';
    html += '<td>' + ep.errors + '</td>';
    html += '<td>' + ep.avg_ms + '</td>';
    html += '<td style="color:#64748B">' + ep.min_ms + '</td>';
    html += '<td style="color:#64748B">' + ep.max_ms + '</td>';
    html += '<td><span class="badge ' + badgeCls + '">' + badgeText + '</span></td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  el.innerHTML = html;
}

loadAnalytics();
setInterval(loadAnalytics, 10000);
</script>
</body>
</html>
"""


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("AGENT_TEST_PORT", "8099"))
    uvicorn.run(app, host="0.0.0.0", port=port)
