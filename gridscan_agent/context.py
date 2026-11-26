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


SEEN_LIMIT = 500        # full identifiers remembered from API results, per session
SEEN_IN_PROMPT = 25     # of those, listed in the system prompt

# Whole-value identifiers in API results.
_FULL_ID = {
    "stake_address": re.compile(r'stake1[a-z0-9]{50,60}'),
    "payment_address": re.compile(r'addr1[a-z0-9]{50,110}'),
    "pool_id": re.compile(r'pool1[a-z0-9]{50,60}'),
    "drep_id": re.compile(r'drep(?:_script)?1[a-z0-9]{50,60}'),
    "hash": re.compile(r'[a-f0-9]{64}'),
}

# Partial references to an identifier in a user message.
_FRAG = r'([a-z0-9_]{3,})'
_PARTIAL = [
    ("prefix_suffix", re.compile(r'(?<![a-z0-9_])([a-z0-9_]{4,})\s?(?:\.{2,}|\u2026)\s?([a-z0-9]{3,})(?![a-z0-9])')),
    ("suffix", re.compile(r'\b(?:ending|ends|end)\s+(?:in\s+|with\s+)?(?:\.{2,}|\u2026)?' + _FRAG + r'\b')),
    ("prefix", re.compile(r'\b(?:starting|starts|start|beginning|begins)\s+(?:with\s+)?' + _FRAG + r'(?:\.{2,}|\u2026)?')),
]


def find_partial_references(text: str) -> list[tuple[str, str, str]]:
    """Partial identifiers in a message: (as written, prefix, suffix)."""
    low = text.lower()
    out = []
    for kind, rx in _PARTIAL:
        for m in rx.finditer(low):
            if kind == "prefix_suffix":
                pre, suf = m.group(1), m.group(2)
            elif kind == "suffix":
                pre, suf = "", m.group(1)
            else:
                pre, suf = m.group(1), ""
            frag = pre + suf
            # Only fragments that look like part of an identifier (hex, or bech32 with a digit).
            if not (re.fullmatch(r'[a-f0-9]+', frag) or (re.search(r'\d', frag) and re.fullmatch(r'[a-z0-9_]+', frag))):
                continue
            if any(o[1] == pre and o[2] == suf for o in out):
                continue
            out.append((m.group(0).strip(), pre, suf))
    return out


# Memory list for each identifier type. (Deriving the name by adding "s" made "tx_hashs", so
# transaction hashes were never remembered.)
_LIST_FOR = {
    "stake_address": "stake_addresses",
    "payment_address": "payment_addresses",
    "pool_id": "pool_ids",
    "drep_id": "drep_ids",
    "tx_hash": "tx_hashes",
    "asset_unit": "asset_units",
    "epoch": "epochs",
    "block_number": "block_numbers",
}

_SHORTENED = re.compile(r'(?<![a-z0-9_])([a-z0-9_]{4,})(\.{2,}|\u2026)([a-z0-9]{3,})(?![a-z0-9])')


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
    # Full identifiers seen in API results: (value, kind, label), most recent first.
    # The model only ever sees a tool result during the turn it was fetched, so without
    # this a later "the tx ending 92b" can't be resolved to the full hash.
    seen: list = field(default_factory=list)

    def add(self, entity_type: str, value: str | int, set_last: bool = True):
        """Add an identifier to memory, keeping most recent first.

        ``set_last=False`` remembers it without making it the last referenced entity (used for
        identifiers that only appear in the agent's own reply)."""
        target = getattr(self, _LIST_FOR.get(entity_type, ""), None)
        if target is not None:
            if value in target:
                target.remove(value)
            target.insert(0, value)
            # Keep last 10
            while len(target) > 10:
                target.pop()
        if set_last:
            self.last_entity_type = entity_type
            self.last_entity_value = str(value)

    def remember_seen(self, value: str, kind: str, label: str):
        """Remember a full identifier from an API result (most recent first, capped)."""
        self.seen = [s for s in self.seen if s[0] != value]
        self.seen.insert(0, (value, kind, label))
        del self.seen[SEEN_LIMIT:]

    def known_values(self) -> list[tuple[str, str, str]]:
        """Every full identifier this session knows: (value, kind, where it came from)."""
        out, have = [], set()
        for kind, values in (("stake_address", self.stake_addresses), ("payment_address", self.payment_addresses),
                             ("pool_id", self.pool_ids), ("drep_id", self.drep_ids), ("tx_hash", self.tx_hashes),
                             ("asset_unit", self.asset_units)):
            for v in values:
                if v not in have:
                    have.add(v); out.append((v, kind, "conversation"))
        for v, kind, label in self.seen:
            if v not in have:
                have.add(v); out.append((v, kind, label))
        return out

    def get_context_summary(self) -> str:
        """Return a text summary of remembered identifiers for the system prompt.

        Identifiers are always listed in full: a shortened one can't be used in an API call."""
        parts = []
        if self.stake_addresses:
            parts.append(f"Remembered stake addresses: {', '.join(self.stake_addresses[:5])}")
        if self.payment_addresses:
            parts.append(f"Remembered payment addresses: {', '.join(self.payment_addresses[:5])}")
        if self.pool_ids:
            parts.append(f"Remembered pool IDs: {', '.join(self.pool_ids[:5])}")
        if self.tx_hashes:
            parts.append(f"Remembered tx hashes: {', '.join(self.tx_hashes[:10])}")
        if self.drep_ids:
            parts.append(f"Remembered DRep IDs: {', '.join(self.drep_ids[:5])}")
        if self.asset_units:
            parts.append(f"Remembered assets: {', '.join(self.asset_units[:5])}")
        if self.last_entity_type:
            parts.append(f"Last referenced entity: {self.last_entity_type} = {self.last_entity_value}")
        if self.seen:
            recent = self.seen[:SEEN_IN_PROMPT]
            more = len(self.seen) - len(recent)
            parts.append("Identifiers from recent API results (full values, most recent first"
                         + (f"; {more} more remembered" if more > 0 else "") + "):\n"
                         + "\n".join(f"- {label}: {v}" for v, _kind, label in recent))
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

    def _extract_identifiers(self, text: str, session_id: str, set_last: bool = True):
        """Scan text for Cardano identifiers and add them to session memory."""
        self._ensure_session(session_id)
        memory = self._sessions[session_id]["memory"]
        add = memory.add
        if not set_last:
            def add(kind, value):
                memory.add(kind, value, set_last=False)

        for match in PATTERNS["stake_address"].finditer(text):
            add("stake_address", match.group())
        for match in PATTERNS["payment_address"].finditer(text):
            add("payment_address", match.group())
        for match in PATTERNS["pool_id"].finditer(text):
            add("pool_id", match.group())
        for match in PATTERNS["drep_id"].finditer(text):
            add("drep_id", match.group())
        for match in PATTERNS["tx_hash"].finditer(text):
            val = match.group()
            # Distinguish tx hashes from asset policy IDs (both 64 hex)
            # Policy IDs are part of asset units (longer), tx hashes stand alone
            if len(val) == 64:
                add("tx_hash", val)
        for match in PATTERNS["epoch"].finditer(text):
            add("epoch", int(match.group(1)))
        for match in PATTERNS["block_number"].finditer(text):
            add("block_number", int(match.group(1)))

    def remember_api_result(self, session_id: str, tool_name: str, arguments: dict, payload: Any):
        """Remember full identifiers from a tool call: the ones it was called with (these become
        the last referenced entity) and every one in its response, labelled by field name."""
        self._ensure_session(session_id)
        memory = self._sessions[session_id]["memory"]
        found: list[tuple[str, str, str]] = []

        def walk(node, key):
            if isinstance(node, dict):
                for k, v in node.items():
                    walk(v, str(k))
            elif isinstance(node, list):
                for v in node:
                    walk(v, key)
            elif isinstance(node, str):
                for kind, rx in _FULL_ID.items():
                    if rx.fullmatch(node):
                        found.append((node, kind, f"{key} from {tool_name}" if key else tool_name))
                        break

        walk(payload, "")
        # Insert in reverse so the first item of a list ends up most recent (lists are newest first).
        for value, kind, label in reversed(found):
            memory.remember_seen(value, kind, label)
        for v in (arguments or {}).values():
            if isinstance(v, str):
                self._extract_identifiers(v, session_id)

    def resolve_partial_references(self, session_id: str, text: str) -> list[dict]:
        """Match partial identifiers in a message ("the tx ending 92b", "43ab5bc9...7d6192b")
        against every full identifier the session knows."""
        known = self.get_memory(session_id).known_values()
        out = []
        for written, pre, suf in find_partial_references(text):
            matches = [{"value": v, "kind": kind, "source": src} for v, kind, src in known
                       if v.startswith(pre) and v.endswith(suf) and len(v) > len(pre) + len(suf)]
            out.append({"written": written, "prefix": pre, "suffix": suf, "matches": matches})
        return out

    def expand_shortened(self, session_id: str, text: str) -> str:
        """Replace shortened identifiers ("43ab5bc9...7d6192b") with the full value when exactly one
        identifier this session knows matches; anything else is left as written."""
        known = [v for v, _k, _s in self.get_memory(session_id).known_values()]

        def full(m):
            pre, suf = m.group(1), m.group(3)
            hits = {v for v in known if v.startswith(pre) and v.endswith(suf) and len(v) > len(pre) + len(suf)}
            return hits.pop() if len(hits) == 1 else m.group(0)

        return _SHORTENED.sub(full, text)

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
            # The reply mentions many identifiers in passing (the stake key, a source tx); the
            # entity the user means by "that transaction" is the one last asked or looked up.
            self._extract_identifiers(content, session_id, set_last=False)
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
