"""
Tests for V2 Webhook Router — multi-route resolution logic.

Tests:
1. Discord route resolution (guild + channel matching)
2. Telegram route resolution (by legacy instance)
3. Zendesk route resolution (with ticket filtering)
4. Auto-reply selection (highest priority)
5. Suggestion connection filtering
6. Connection context loading
7. Rate limiter creation
"""
import pytest
import asyncio
import os
import sys
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

# Ensure backend dir is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── Fixtures ──

class MockCollection:
    """Mock MongoDB collection with find/find_one/insert_one/update_one."""
    def __init__(self, data=None):
        self._data = data or []

    def find(self, query=None, projection=None):
        results = self._data
        if query:
            results = [d for d in results if self._matches(d, query)]
        return MockCursor(results)

    async def find_one(self, query=None, projection=None):
        for d in self._data:
            if self._matches(d, query or {}):
                return d
        return None

    async def insert_one(self, doc):
        self._data.append(doc)
        return MagicMock(inserted_id="mock_id")

    async def update_one(self, query, update, upsert=False):
        return MagicMock(modified_count=1)

    async def count_documents(self, query):
        return len([d for d in self._data if self._matches(d, query)])

    async def create_index(self, *args, **kwargs):
        pass

    def _matches(self, doc, query):
        for key, val in query.items():
            if key == "$and":
                return all(self._matches(doc, sub) for sub in val)
            if "." in key:
                parts = key.split(".")
                d = doc
                for p in parts:
                    d = d.get(p, {}) if isinstance(d, dict) else None
                if isinstance(val, dict):
                    if "$ne" in val and d == val["$ne"]:
                        return False
                    if "$in" in val and d not in val["$in"]:
                        return False
                elif d != val:
                    return False
            elif isinstance(val, dict):
                if "$ne" in val and doc.get(key) == val["$ne"]:
                    return False
                if "$in" in val and doc.get(key) not in val["$in"]:
                    return False
            elif doc.get(key) != val:
                return False
        return True


class MockCursor:
    def __init__(self, data):
        self._data = data

    def sort(self, *args, **kwargs):
        return self

    def limit(self, n):
        self._data = self._data[:n]
        return self

    async def to_list(self, length=None):
        if length:
            return self._data[:length]
        return self._data


class MockDB:
    def __init__(self):
        self.connections = MockCollection()
        self.bots = MockCollection()
        self.connected_accounts = MockCollection()
        self.bot_config = MockCollection()
        self.api_integrations = MockCollection()
        self.v2_suggestions = MockCollection()
        self.conversations = MockCollection()


# ── Test Data ──

def make_connection(id, provider, bot_id, account_id, response_mode="auto_reply",
                    enabled=True, priority=0, destination=None, legacy_instance_id=None):
    return {
        "id": id, "org_id": "org1", "bot_id": bot_id, "account_id": account_id,
        "provider": provider, "name": f"Conn-{id[:8]}",
        "enabled": enabled, "priority": priority,
        "response_mode": response_mode,
        "destination": destination or {},
        "overrides": {}, "override_flags": {},
        "legacy_instance_id": legacy_instance_id,
    }


def make_bot(id, org_id="org1", legacy_instance_id=None):
    return {
        "id": id, "org_id": org_id, "name": f"Bot-{id[:8]}",
        "legacy_instance_id": legacy_instance_id,
        "persona": "Test bot", "custom_instructions": "",
        "tone_instructions": "", "knowledge_gate": "strict",
    }


def make_account(id, org_id="org1", provider="discord"):
    return {
        "id": id, "org_id": org_id, "provider": provider,
        "name": f"Account-{id[:8]}", "status": "connected",
        "credentials": {"bot_token": "test_token"},
        "metadata": {"listen_mode": "all_channels"},
    }


# ── Tests ──

@pytest.mark.asyncio
async def test_discord_route_resolution_all_channels():
    """Discord connections with listen_mode=all_channels match any channel."""
    import webhook_router as wr

    db = MockDB()
    db.connections = MockCollection([
        make_connection("conn1", "discord", "bot1", "acc1", priority=10,
                        destination={"guild_id": "guild123", "listen_mode": "all_channels"}),
    ])
    wr.init(db)

    routes = await wr.resolve_discord_routes("guild123", "any_channel")
    assert len(routes) == 1
    assert routes[0]["id"] == "conn1"


@pytest.mark.asyncio
async def test_discord_route_resolution_specific_channels():
    """Discord connections with specific_channels only match listed channels."""
    import webhook_router as wr

    db = MockDB()
    db.connections = MockCollection([
        make_connection("conn1", "discord", "bot1", "acc1", priority=10,
                        destination={"guild_id": "guild123", "listen_mode": "specific_channels",
                                     "channel_ids": ["ch1", "ch2"]}),
    ])
    wr.init(db)

    # Should match
    routes = await wr.resolve_discord_routes("guild123", "ch1")
    assert len(routes) == 1

    # Should not match
    routes = await wr.resolve_discord_routes("guild123", "ch99")
    assert len(routes) == 0


@pytest.mark.asyncio
async def test_discord_route_no_match():
    """No connections for unknown guild."""
    import webhook_router as wr

    db = MockDB()
    db.connections = MockCollection([
        make_connection("conn1", "discord", "bot1", "acc1",
                        destination={"guild_id": "guild123", "listen_mode": "all_channels"}),
    ])
    wr.init(db)

    routes = await wr.resolve_discord_routes("unknown_guild", "any_channel")
    assert len(routes) == 0


@pytest.mark.asyncio
async def test_discord_multi_route():
    """Multiple connections for the same guild return ordered by priority."""
    import webhook_router as wr

    db = MockDB()
    db.connections = MockCollection([
        make_connection("conn_auto", "discord", "bot1", "acc1", response_mode="auto_reply",
                        priority=10, destination={"guild_id": "guild123", "listen_mode": "all_channels"}),
        make_connection("conn_assist", "discord", "bot2", "acc1", response_mode="agent_assist",
                        priority=5, destination={"guild_id": "guild123", "listen_mode": "all_channels"}),
    ])
    wr.init(db)

    routes = await wr.resolve_discord_routes("guild123", "any_channel")
    assert len(routes) == 2


@pytest.mark.asyncio
async def test_auto_reply_selection():
    """select_auto_reply_connection picks highest-priority auto_reply."""
    import webhook_router as wr

    connections = [
        make_connection("conn1", "discord", "bot1", "acc1", response_mode="auto_reply", priority=10),
        make_connection("conn2", "discord", "bot2", "acc1", response_mode="agent_assist", priority=20),
        make_connection("conn3", "discord", "bot3", "acc1", response_mode="auto_reply", priority=5),
    ]

    auto = wr.select_auto_reply_connection(connections)
    assert auto is not None
    assert auto["id"] == "conn1"  # First auto_reply in priority-sorted list


@pytest.mark.asyncio
async def test_suggestion_connections():
    """get_suggestion_connections returns non-auto_reply connections."""
    import webhook_router as wr

    connections = [
        make_connection("conn1", "discord", "bot1", "acc1", response_mode="auto_reply"),
        make_connection("conn2", "discord", "bot2", "acc1", response_mode="agent_assist"),
        make_connection("conn3", "discord", "bot3", "acc1", response_mode="internal_note"),
        make_connection("conn4", "discord", "bot4", "acc1", response_mode="sidebar_only"),
    ]

    suggestions = wr.get_suggestion_connections(connections)
    assert len(suggestions) == 3
    assert all(s["response_mode"] != "auto_reply" for s in suggestions)


@pytest.mark.asyncio
async def test_telegram_route_by_legacy_instance():
    """Telegram connections found via legacy_instance_id."""
    import webhook_router as wr

    db = MockDB()
    db.connections = MockCollection([
        make_connection("tg_conn1", "telegram", "bot1", "acc1",
                        legacy_instance_id="legacy123"),
    ])
    wr.init(db)

    routes = await wr.resolve_telegram_routes_by_instance("legacy123")
    assert len(routes) == 1
    assert routes[0]["id"] == "tg_conn1"


@pytest.mark.asyncio
async def test_telegram_route_fallback_via_bot():
    """Telegram connections found via bot.legacy_instance_id when connection has no legacy_instance_id."""
    import webhook_router as wr

    db = MockDB()
    db.bots = MockCollection([make_bot("bot1", legacy_instance_id="legacy123")])
    db.connections = MockCollection([
        make_connection("tg_conn1", "telegram", "bot1", "acc1"),
    ])
    wr.init(db)

    routes = await wr.resolve_telegram_routes_by_instance("legacy123")
    assert len(routes) == 1


@pytest.mark.asyncio
async def test_zendesk_route_with_ticket_group_filter():
    """Zendesk connections filter by ticket_group when configured."""
    import webhook_router as wr

    db = MockDB()
    db.connections = MockCollection([
        make_connection("zd_billing", "zendesk", "bot1", "acc1",
                        destination={"ticket_group": "billing"},
                        legacy_instance_id="legacy1"),
        make_connection("zd_support", "zendesk", "bot2", "acc1",
                        destination={"ticket_group": "support"},
                        legacy_instance_id="legacy1"),
    ])
    wr.init(db)

    # Billing ticket should match billing connection only
    routes = await wr.resolve_zendesk_routes_by_instance(
        "legacy1", {"group_id": "billing", "tags": []}
    )
    assert len(routes) == 1
    assert routes[0]["id"] == "zd_billing"


@pytest.mark.asyncio
async def test_zendesk_route_no_filter_returns_all():
    """Zendesk connections with no destination filter return all connections."""
    import webhook_router as wr

    db = MockDB()
    db.connections = MockCollection([
        make_connection("zd1", "zendesk", "bot1", "acc1",
                        destination={}, legacy_instance_id="legacy1"),
        make_connection("zd2", "zendesk", "bot2", "acc1",
                        destination={}, legacy_instance_id="legacy1"),
    ])
    wr.init(db)

    routes = await wr.resolve_zendesk_routes_by_instance("legacy1", {"group_id": "any", "tags": []})
    assert len(routes) == 2


@pytest.mark.asyncio
async def test_connection_context_loading():
    """load_connection_context enriches connection with bot + account data."""
    import webhook_router as wr

    db = MockDB()
    db.bots = MockCollection([make_bot("bot1", legacy_instance_id="legacy1")])
    db.connected_accounts = MockCollection([make_account("acc1")])
    db.bot_config = MockCollection([{"instance_id": "legacy1", "persona": "Test persona"}])
    wr.init(db)

    conn = make_connection("conn1", "discord", "bot1", "acc1")
    ctx = await wr.load_connection_context(conn)
    assert ctx is not None
    assert ctx["instance_id"] == "legacy1"
    assert ctx["bot"]["name"] == "Bot-bot1"
    assert ctx["account"]["provider"] == "discord"


@pytest.mark.asyncio
async def test_rate_limiter_creation():
    """Per-account semaphore is created and reused."""
    import webhook_router as wr

    sem1 = wr.get_account_semaphore("acc_123")
    sem2 = wr.get_account_semaphore("acc_123")
    sem3 = wr.get_account_semaphore("acc_456")

    assert sem1 is sem2  # Same account = same semaphore
    assert sem1 is not sem3  # Different account = different semaphore


@pytest.mark.asyncio
async def test_save_v2_suggestion():
    """save_v2_suggestion stores suggestion document."""
    import webhook_router as wr

    db = MockDB()
    wr.init(db)

    await wr.save_v2_suggestion(
        connection_id="conn1", bot_id="bot1", instance_id="inst1",
        platform="discord", user_message="Hello?", ai_response="Hi there!"
    )

    assert len(db.v2_suggestions._data) == 1
    doc = db.v2_suggestions._data[0]
    assert doc["connection_id"] == "conn1"
    assert doc["ai_suggestion"] == "Hi there!"
    assert doc["status"] == "pending"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
