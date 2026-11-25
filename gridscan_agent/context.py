"""
Conversation context manager.

Tracks per-session message history and extracts key identifiers
(addresses, hashes, pool IDs, etc.) from the conversation so the
model can resolve references like "that address" or "show me more".
"""
import re
import time
from typing import Any
from dataclasses import dataclass, field


# Regex patterns for Cardano identifiers
PATTERNS = {
    "stake_address": re.compile(r'\bstake1[a-z0-9]{50,60}\b'),
    "payment_address": re.compile(r'\baddr1[a-z0-9]{50,110}\b'),
    "pool_id": re.compile(r'\bpool1[a-z0-9]{50,60}\b'),
    "drep_id": re.compile(r'\bdrep(?:_script)?1[a-z0-9]{50,60}\b'),
    "tx_hash": re.compile(r'\b[a-f0-9]{64}\b'),
    "asset_unit": re.compile(r'\b[a-f0-9]{56}[a-f0-9]+\b'),
    "epoch": re.compile(r'\bepoch\s+(\d+)\b', re.IGNORECASE),
    "block_number": re.compile(r'\bblock\s+#?(\d+)\b', re.IGNORECASE),
}


@dataclass
class SessionMemory:
    """Remembered identifiers for a single session."""
    stake_addresses: list[str] = field(default_factory=list)
    payment_addresses: list[str] = field(default_factory=list)
    pool_ids: list[str] = field(default_factory=list)
    drep_ids: list[str] = field(default_factory=list)
    tx_hashes: list[str] = field(default_factory=list)
    asset_units: list[str] = field(default_factory=list)
    epochs: list[int] = field(default_factory=list)
    block_numbers: list[int] = field(default_factory=list)
    last_entity_type: str = ""
    last_entity_value: str = ""

    def add(self, entity_type: str, value: str | int):
        """Add an identifier to memory, keeping most recent first."""
        target = getattr(self, f"{entity_type}s" if not entity_type.endswith("s") else entity_type, None)
        if target is None:
            # For types like "stake_address" -> "stake_addresses"
            attr = entity_type + "es" if entity_type.endswith("s") else entity_type + "s"
            target = getattr(self, attr, None)
        if target is not None:
            if value in target:
                target.remove(value)
            target.insert(0, value)
            # Keep last 10
            while len(target) > 10:
                target.pop()
        self.last_entity_type = entity_type
        self.last_entity_value = str(value)

    def get_context_summary(self) -> str:
        """Return a text summary of remembered identifiers for the system prompt."""
        parts = []
        if self.stake_addresses:
            parts.append(f"Remembered stake addresses: {', '.join(self.stake_addresses[:3])}")
        if self.payment_addresses:
            parts.append(f"Remembered payment addresses: {', '.join(self.payment_addresses[:3])}")
        if self.pool_ids:
            parts.append(f"Remembered pool IDs: {', '.join(self.pool_ids[:3])}")
        if self.tx_hashes:
            parts.append(f"Remembered tx hashes: {', '.join(self.tx_hashes[:3])}")
        if self.drep_ids:
            parts.append(f"Remembered DRep IDs: {', '.join(self.drep_ids[:3])}")
        if self.asset_units:
            parts.append(f"Remembered assets: {', '.join(self.asset_units[:3])}")
        if self.last_entity_type:
            parts.append(f"Last referenced entity: {self.last_entity_type} = {self.last_entity_value}")
        return "\n".join(parts) if parts else "No identifiers remembered yet."


class ConversationContext:
    """
    Manages conversation history and entity memory across sessions.

    Usage:
        ctx = ConversationContext(max_messages=20)
        ctx.add_user_message("session-1", "Show me stake1abc...")
        ctx.add_assistant_message("session-1", "Here's the account...")
        messages = ctx.get_messages("session-1")
        memory = ctx.get_memory("session-1")
    """

    def __init__(self, max_messages: int = 20):
        self.max_messages = max_messages
        self._sessions: dict[str, dict[str, Any]] = {}

    def _ensure_session(self, session_id: str):
        if session_id not in self._sessions:
            self._sessions[session_id] = {
                "messages": [],
                "memory": SessionMemory(),
                "created_at": time.time(),
                "last_active": time.time(),
            }

    def _extract_identifiers(self, text: str, session_id: str):
        """Scan text for Cardano identifiers and add them to session memory."""
        self._ensure_session(session_id)
        memory = self._sessions[session_id]["memory"]

        for match in PATTERNS["stake_address"].finditer(text):
            memory.add("stake_address", match.group())
        for match in PATTERNS["payment_address"].finditer(text):
            memory.add("payment_address", match.group())
        for match in PATTERNS["pool_id"].finditer(text):
            memory.add("pool_id", match.group())
        for match in PATTERNS["drep_id"].finditer(text):
            memory.add("drep_id", match.group())
        for match in PATTERNS["tx_hash"].finditer(text):
            val = match.group()
            # Distinguish tx hashes from asset policy IDs (both 64 hex)
            # Policy IDs are part of asset units (longer), tx hashes stand alone
            if len(val) == 64:
                memory.add("tx_hash", val)
        for match in PATTERNS["epoch"].finditer(text):
            memory.add("epoch", int(match.group(1)))
        for match in PATTERNS["block_number"].finditer(text):
            memory.add("block_number", int(match.group(1)))

    def add_user_message(self, session_id: str, content: str):
        """Add a user message and extract identifiers."""
        self._ensure_session(session_id)
        self._extract_identifiers(content, session_id)
        self._sessions[session_id]["messages"].append({
            "role": "user",
            "content": content,
        })
        self._trim(session_id)
        self._sessions[session_id]["last_active"] = time.time()

    def add_assistant_message(self, session_id: str, content: str | list):
        """Add an assistant message (text or tool_use blocks)."""
        self._ensure_session(session_id)
        if isinstance(content, str):
            self._extract_identifiers(content, session_id)
        self._sessions[session_id]["messages"].append({
            "role": "assistant",
            "content": content,
        })
        self._trim(session_id)
        self._sessions[session_id]["last_active"] = time.time()

    def add_tool_result(self, session_id: str, tool_use_id: str, result: str):
        """Add a tool result message."""
        self._ensure_session(session_id)
        self._extract_identifiers(result, session_id)
        self._sessions[session_id]["messages"].append({
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "content": result,
            }],
        })
        self._sessions[session_id]["last_active"] = time.time()

    def add_tool_result_batch(self, session_id: str, results: list[dict]):
        """Add multiple tool results as a single user message (Anthropic format)."""
        self._ensure_session(session_id)
        for r in results:
            if isinstance(r.get("content"), str):
                self._extract_identifiers(r["content"], session_id)
        self._sessions[session_id]["messages"].append({
            "role": "user",
            "content": results,
        })
        self._sessions[session_id]["last_active"] = time.time()

    def get_messages(self, session_id: str) -> list[dict]:
        """Get the message history for a session."""
        self._ensure_session(session_id)
        return self._sessions[session_id]["messages"].copy()

    def get_memory(self, session_id: str) -> SessionMemory:
        """Get the entity memory for a session."""
        self._ensure_session(session_id)
        return self._sessions[session_id]["memory"]

    def clear_session(self, session_id: str):
        """Clear a session's history and memory."""
        if session_id in self._sessions:
            del self._sessions[session_id]

    def list_sessions(self) -> list[str]:
        """Return all active session IDs."""
        return list(self._sessions.keys())

    def _trim(self, session_id: str):
        """Keep only the last max_messages messages."""
        msgs = self._sessions[session_id]["messages"]
        if len(msgs) > self.max_messages:
            self._sessions[session_id]["messages"] = msgs[-self.max_messages:]

    def cleanup_stale(self, max_age_seconds: int = 3600):
        """Remove sessions older than max_age_seconds."""
        now = time.time()
        stale = [sid for sid, s in self._sessions.items()
                 if now - s["last_active"] > max_age_seconds]
        for sid in stale:
            del self._sessions[sid]
