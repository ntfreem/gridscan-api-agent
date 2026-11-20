"""
BitBotPro Preview Proxy — Forwards all /api requests to api.bitbotpro.io.
This proxy exists only in the Emergent preview environment to bypass CORS
restrictions when the frontend dev server talks to the self-hosted backend.
"""
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os

app = FastAPI(title="BitBotPro Preview Proxy")

UPSTREAM = os.environ.get("UPSTREAM_API", "https://api.bitbotpro.io")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy(path: str, request: Request):
    url = f"{UPSTREAM}/api/{path}"
    if request.url.query:
        url += f"?{request.url.query}"

    headers = {}
    for key, value in request.headers.items():
        lower = key.lower()
        if lower in ("host", "content-length", "transfer-encoding", "connection"):
            continue
        headers[key] = value

    body = await request.body()

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.request(
            method=request.method,
            url=url,
            headers=headers,
            content=body if body else None,
            follow_redirects=False,
        )

    # Build response, handling multiple set-cookie headers correctly
    response = Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )

    skip_headers = {"transfer-encoding", "content-encoding", "content-length", "connection"}
    seen = set()
    for key, value in resp.headers.multi_items():
        lower = key.lower()
        if lower in skip_headers:
            continue
        if lower == "set-cookie":
            # Rewrite upstream Domain to preview domain for session cookies
            rewritten = value.replace(f"Domain=api.bitbotpro.io", "")
            # Remove Secure flag for preview (may be HTTP in dev)
            response.headers.append(key, rewritten)
        elif lower not in seen:
            response.headers[key] = value
            seen.add(lower)

    return response

@app.get("/health")
async def health():
    return {"status": "proxy", "upstream": UPSTREAM}
