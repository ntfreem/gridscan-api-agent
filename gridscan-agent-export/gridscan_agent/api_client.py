"""
HTTP client for making Gridscan API calls.

Handles authentication, rate limiting, URL building from tool metadata,
and returns raw JSON responses.
"""
import time
import json
import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger("gridscan_agent.api_client")


class RateLimiter:
    """Simple token-bucket rate limiter."""

    def __init__(self, max_per_minute: int = 50):
        self.max_per_minute = max_per_minute
        self.tokens = max_per_minute
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(self.max_per_minute, self.tokens + elapsed * (self.max_per_minute / 60))
            self.last_refill = now
            if self.tokens < 1:
                wait = (1 - self.tokens) / (self.max_per_minute / 60)
                logger.info(f"Rate limited — waiting {wait:.1f}s")
                await asyncio.sleep(wait)
                self.tokens = 1
            self.tokens -= 1


class GridscanAPIClient:
    """
    Makes HTTP calls to the Gridscan API using tool metadata.

    Usage:
        client = GridscanAPIClient(base_url, api_key)
        result = await client.call_tool(tool_def, {"stake_address": "stake1..."})
    """

    def __init__(
        self,
        base_url: str = "https://ada.api.gridscan.io",
        api_key: str = "",
        timeout: int = 30,
        max_per_minute: int = 50,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.rate_limiter = RateLimiter(max_per_minute)
        self._client = httpx.AsyncClient(timeout=timeout)
        self._call_log: list[dict] = []

    async def call_tool(self, tool_def: dict, arguments: dict[str, Any]) -> dict:
        """
        Execute an API call based on a tool definition and the model's arguments.

        Returns:
            {
                "success": bool,
                "status_code": int,
                "data": <parsed JSON or error string>,
                "endpoint": str,
                "duration_ms": int,
            }
        """
        await self.rate_limiter.acquire()

        path_template = tool_def["_path"]
        method = tool_def["_method"]
        params_map = tool_def["_params_map"]

        # Build URL: substitute path params, collect query params
        path = path_template
        query_params = {}
        body_data = {}

        for arg_name, arg_value in arguments.items():
            meta = params_map.get(arg_name)
            if not meta:
                # Unknown param — try as query
                query_params[arg_name] = arg_value
                continue

            if meta["in"] == "path":
                path = path.replace(f"{{{arg_name}}}", str(arg_value))
            elif meta["in"] == "query":
                query_params[arg_name] = arg_value
            elif meta["in"] == "body":
                body_data[arg_name] = arg_value

        url = f"{self.base_url}{path}"
        headers = {"Accept": "application/json"}
        if self.api_key:
            headers["x-project-id"] = self.api_key

        start = time.monotonic()
        try:
            if method == "GET":
                resp = await self._client.get(url, params=query_params, headers=headers)
            elif method == "POST":
                resp = await self._client.post(url, params=query_params, headers=headers, json=body_data)
            else:
                resp = await self._client.request(method, url, params=query_params, headers=headers, json=body_data or None)

            duration_ms = int((time.monotonic() - start) * 1000)

            # Parse response
            try:
                data = resp.json()
            except Exception:
                data = resp.text

            result = {
                "success": 200 <= resp.status_code < 300,
                "status_code": resp.status_code,
                "data": data,
                "endpoint": f"{method} {path}",
                "url": str(resp.url),
                "duration_ms": duration_ms,
            }

            # Rate limit headers
            rl_remaining = resp.headers.get("X-RateLimit-Remaining")
            if rl_remaining is not None:
                result["rate_limit_remaining"] = int(rl_remaining)

        except httpx.TimeoutException:
            duration_ms = int((time.monotonic() - start) * 1000)
            result = {
                "success": False,
                "status_code": 0,
                "data": f"Request timed out after {self.timeout}s",
                "endpoint": f"{method} {path}",
                "url": url,
                "duration_ms": duration_ms,
            }
        except Exception as e:
            duration_ms = int((time.monotonic() - start) * 1000)
            result = {
                "success": False,
                "status_code": 0,
                "data": f"Request failed: {str(e)}",
                "endpoint": f"{method} {path}",
                "url": url,
                "duration_ms": duration_ms,
            }

        # Log the call
        self._call_log.append({
            "tool": tool_def["name"],
            "endpoint": result["endpoint"],
            "status": result["status_code"],
            "duration_ms": duration_ms,
            "success": result["success"],
            "timestamp": time.time(),
        })
        logger.info(f"API call: {result['endpoint']} → {result['status_code']} ({duration_ms}ms)")

        return result

    @property
    def call_log(self) -> list[dict]:
        """Return the full call log for auditing."""
        return self._call_log.copy()

    def get_analytics(self) -> dict:
        """Aggregate call log into analytics: usage by endpoint, error rates, latency stats."""
        if not self._call_log:
            return {"total_calls": 0, "endpoints": {}, "errors": 0, "avg_duration_ms": 0}

        total = len(self._call_log)
        errors = sum(1 for c in self._call_log if not c["success"])
        total_duration = sum(c["duration_ms"] for c in self._call_log)

        # Per-endpoint stats
        ep_stats: dict[str, dict] = {}
        for c in self._call_log:
            ep = c["tool"]
            if ep not in ep_stats:
                ep_stats[ep] = {
                    "calls": 0, "errors": 0, "total_ms": 0,
                    "min_ms": float("inf"), "max_ms": 0,
                    "last_status": 0, "endpoint_path": c.get("endpoint", ""),
                }
            s = ep_stats[ep]
            s["calls"] += 1
            s["total_ms"] += c["duration_ms"]
            s["min_ms"] = min(s["min_ms"], c["duration_ms"])
            s["max_ms"] = max(s["max_ms"], c["duration_ms"])
            s["last_status"] = c["status"]
            if not c["success"]:
                s["errors"] += 1

        # Compute averages and sort by call count
        endpoints = {}
        for ep, s in sorted(ep_stats.items(), key=lambda x: x[1]["calls"], reverse=True):
            endpoints[ep] = {
                "calls": s["calls"],
                "errors": s["errors"],
                "error_rate": round(s["errors"] / s["calls"] * 100, 1) if s["calls"] else 0,
                "avg_ms": round(s["total_ms"] / s["calls"]) if s["calls"] else 0,
                "min_ms": s["min_ms"] if s["min_ms"] != float("inf") else 0,
                "max_ms": s["max_ms"],
                "endpoint_path": s["endpoint_path"],
            }

        return {
            "total_calls": total,
            "total_errors": errors,
            "error_rate": round(errors / total * 100, 1) if total else 0,
            "avg_duration_ms": round(total_duration / total) if total else 0,
            "unique_endpoints_used": len(ep_stats),
            "total_endpoints_available": 89,
            "coverage_pct": round(len(ep_stats) / 89 * 100, 1),
            "endpoints": endpoints,
        }

    async def close(self):
        await self._client.aclose()
