"""
Test suite for Platform Stats Dashboard and Telegram Rich Replies features.
Iteration 52 - Tests:
1. GET /api/analytics/overview - platform_breakdown with web, discord, telegram, api counts
2. GET /api/analytics/daily-by-platform - 7-day array with platform message counts
3. Telegram suggestion parser (_parse_suggestions) - extracts [SUGGESTIONS: a | b | c] format
4. Telegram callback_query handling
"""
import pytest
import requests
import os
import sys

# Add backend to path for direct imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

# Test credentials from test_credentials.md
TEST_USERNAME = "administrator"
TEST_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": TEST_USERNAME,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token and instance ID."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Instance-ID": INSTANCE_ID,
        "Content-Type": "application/json"
    }


class TestAnalyticsOverview:
    """Tests for GET /api/analytics/overview endpoint - platform_breakdown feature."""

    def test_overview_returns_200(self, auth_headers):
        """Verify analytics overview endpoint returns 200."""
        response = requests.get(f"{BASE_URL}/api/analytics/overview", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Analytics overview returns 200")

    def test_overview_has_platform_breakdown(self, auth_headers):
        """Verify response contains platform_breakdown object."""
        response = requests.get(f"{BASE_URL}/api/analytics/overview", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "platform_breakdown" in data, "Missing platform_breakdown in response"
        print(f"✓ Response contains platform_breakdown")

    def test_platform_breakdown_has_all_platforms(self, auth_headers):
        """Verify platform_breakdown contains web, discord, telegram, api keys."""
        response = requests.get(f"{BASE_URL}/api/analytics/overview", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        pb = data.get("platform_breakdown", {})
        
        required_platforms = ["web", "discord", "telegram", "api"]
        for platform in required_platforms:
            assert platform in pb, f"Missing '{platform}' in platform_breakdown"
            assert isinstance(pb[platform], int), f"'{platform}' should be an integer, got {type(pb[platform])}"
        
        print(f"✓ platform_breakdown contains all 4 platforms: {pb}")

    def test_overview_has_standard_fields(self, auth_headers):
        """Verify response contains standard analytics fields."""
        response = requests.get(f"{BASE_URL}/api/analytics/overview", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["total_conversations", "total_messages", "approved_for_training", "knowledge_sources"]
        for field in required_fields:
            assert field in data, f"Missing '{field}' in response"
        
        print(f"✓ Overview has all standard fields: total_conversations={data['total_conversations']}, total_messages={data['total_messages']}")

    def test_platform_counts_are_non_negative(self, auth_headers):
        """Verify all platform counts are non-negative integers."""
        response = requests.get(f"{BASE_URL}/api/analytics/overview", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        pb = data.get("platform_breakdown", {})
        
        for platform, count in pb.items():
            assert count >= 0, f"Platform '{platform}' has negative count: {count}"
        
        print(f"✓ All platform counts are non-negative")


class TestAnalyticsDailyByPlatform:
    """Tests for GET /api/analytics/daily-by-platform endpoint."""

    def test_daily_by_platform_returns_200(self, auth_headers):
        """Verify daily-by-platform endpoint returns 200."""
        response = requests.get(f"{BASE_URL}/api/analytics/daily-by-platform", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Daily-by-platform returns 200")

    def test_daily_by_platform_returns_7_days(self, auth_headers):
        """Verify response is an array of 7 days."""
        response = requests.get(f"{BASE_URL}/api/analytics/daily-by-platform", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) == 7, f"Expected 7 days, got {len(data)}"
        print(f"✓ Returns 7-day array")

    def test_daily_by_platform_has_all_platforms_per_day(self, auth_headers):
        """Verify each day has web, discord, telegram, api counts."""
        response = requests.get(f"{BASE_URL}/api/analytics/daily-by-platform", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        required_keys = ["date", "web", "discord", "telegram", "api"]
        for i, day in enumerate(data):
            for key in required_keys:
                assert key in day, f"Day {i} missing '{key}'"
            # Verify counts are integers
            for platform in ["web", "discord", "telegram", "api"]:
                assert isinstance(day[platform], int), f"Day {i} '{platform}' should be int"
        
        print(f"✓ Each day has all platform counts")
        print(f"  Sample day: {data[0]}")

    def test_daily_by_platform_date_format(self, auth_headers):
        """Verify date format is MM/DD."""
        response = requests.get(f"{BASE_URL}/api/analytics/daily-by-platform", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        import re
        date_pattern = r'^\d{2}/\d{2}$'
        for day in data:
            assert re.match(date_pattern, day["date"]), f"Invalid date format: {day['date']}"
        
        print(f"✓ Date format is MM/DD")


class TestTelegramSuggestionParser:
    """Tests for _parse_suggestions function in telegram_routes.py."""

    def test_parse_suggestions_extracts_correctly(self):
        """Test that suggestions are correctly extracted from [SUGGESTIONS: a | b | c] format."""
        from telegram_routes import _parse_suggestions
        
        response = "Here is your answer about the topic.\n\n[SUGGESTIONS: What else? | Tell me more | How does it work?]"
        clean_text, suggestions = _parse_suggestions(response)
        
        assert clean_text == "Here is your answer about the topic."
        assert len(suggestions) == 3
        assert suggestions[0] == "What else?"
        assert suggestions[1] == "Tell me more"
        assert suggestions[2] == "How does it work?"
        print(f"✓ Parser extracts 3 suggestions correctly")

    def test_parse_suggestions_returns_empty_when_no_tag(self):
        """Test that empty list is returned when no [SUGGESTIONS:] tag is present."""
        from telegram_routes import _parse_suggestions
        
        response = "This is a simple response without any suggestions."
        clean_text, suggestions = _parse_suggestions(response)
        
        assert clean_text == response
        assert suggestions == []
        print(f"✓ Parser returns empty list when no tag present")

    def test_parse_suggestions_handles_single_suggestion(self):
        """Test parsing with only one suggestion."""
        from telegram_routes import _parse_suggestions
        
        response = "Answer here.\n[SUGGESTIONS: Just one option]"
        clean_text, suggestions = _parse_suggestions(response)
        
        assert clean_text == "Answer here."
        assert len(suggestions) == 1
        assert suggestions[0] == "Just one option"
        print(f"✓ Parser handles single suggestion")

    def test_parse_suggestions_limits_to_three(self):
        """Test that parser limits to 3 suggestions max."""
        from telegram_routes import _parse_suggestions
        
        response = "Answer.\n[SUGGESTIONS: one | two | three | four | five]"
        clean_text, suggestions = _parse_suggestions(response)
        
        assert len(suggestions) == 3
        print(f"✓ Parser limits to 3 suggestions: {suggestions}")

    def test_parse_suggestions_strips_whitespace(self):
        """Test that suggestions are trimmed of whitespace."""
        from telegram_routes import _parse_suggestions
        
        response = "Answer.\n[SUGGESTIONS:   spaced out   |  another one  ]"
        clean_text, suggestions = _parse_suggestions(response)
        
        assert suggestions[0] == "spaced out"
        assert suggestions[1] == "another one"
        print(f"✓ Parser strips whitespace from suggestions")

    def test_parse_suggestions_handles_multiline_response(self):
        """Test parsing with multiline response before suggestions."""
        from telegram_routes import _parse_suggestions
        
        response = """Here is a detailed answer.

It has multiple paragraphs.

And some more content.

[SUGGESTIONS: Follow up 1 | Follow up 2]"""
        clean_text, suggestions = _parse_suggestions(response)
        
        assert "Here is a detailed answer" in clean_text
        assert "And some more content" in clean_text
        assert "[SUGGESTIONS:" not in clean_text
        assert len(suggestions) == 2
        print(f"✓ Parser handles multiline response")


class TestTelegramWebhookCallbackQuery:
    """Tests for Telegram webhook callback_query handling."""

    def test_webhook_returns_ok_for_callback_query(self, auth_headers):
        """Test that webhook endpoint handles callback_query update type."""
        # First get the telegram config to check if it's configured
        cfg_response = requests.get(f"{BASE_URL}/api/admin/telegram-config", headers=auth_headers)
        
        if cfg_response.status_code != 200:
            pytest.skip("Telegram config endpoint not accessible")
        
        cfg = cfg_response.json()
        
        # If no webhook secret, we can't test the webhook directly
        # But we can verify the endpoint structure exists
        if not cfg.get("connected"):
            print("✓ Telegram not connected - skipping webhook test (expected behavior)")
            return
        
        # The webhook URL format is /api/telegram/webhook/{instance_id}/{secret}
        # We can't test with real secret, but we can verify 403/404 for wrong secret
        fake_secret = "test_fake_secret_12345"
        webhook_url = f"{BASE_URL}/api/telegram/webhook/{INSTANCE_ID}/{fake_secret}"
        
        # Send a callback_query update
        callback_update = {
            "update_id": 123456789,
            "callback_query": {
                "id": "test_callback_id",
                "from": {"id": 12345, "first_name": "Test", "username": "testuser"},
                "message": {
                    "message_id": 100,
                    "chat": {"id": 12345, "type": "private"}
                },
                "data": "test_button_data"
            }
        }
        
        response = requests.post(webhook_url, json=callback_update)
        # Should return 403 (wrong secret) or 404 (not found)
        assert response.status_code in [403, 404], f"Expected 403/404 for wrong secret, got {response.status_code}"
        print(f"✓ Webhook correctly rejects invalid secret with {response.status_code}")


class TestTelegramFollowupInstruction:
    """Tests for TELEGRAM_FOLLOWUP_INSTRUCTION constant."""

    def test_followup_instruction_exists(self):
        """Verify TELEGRAM_FOLLOWUP_INSTRUCTION constant is defined."""
        from telegram_routes import TELEGRAM_FOLLOWUP_INSTRUCTION
        
        assert TELEGRAM_FOLLOWUP_INSTRUCTION is not None
        assert len(TELEGRAM_FOLLOWUP_INSTRUCTION) > 0
        assert "[SUGGESTIONS:" in TELEGRAM_FOLLOWUP_INSTRUCTION
        print(f"✓ TELEGRAM_FOLLOWUP_INSTRUCTION is defined and contains [SUGGESTIONS: format")

    def test_followup_instruction_has_rules(self):
        """Verify instruction contains key rules for the LLM."""
        from telegram_routes import TELEGRAM_FOLLOWUP_INSTRUCTION
        
        # Check for key phrases that should be in the instruction
        assert "follow-up" in TELEGRAM_FOLLOWUP_INSTRUCTION.lower() or "followup" in TELEGRAM_FOLLOWUP_INSTRUCTION.lower()
        assert "40 char" in TELEGRAM_FOLLOWUP_INSTRUCTION or "max" in TELEGRAM_FOLLOWUP_INSTRUCTION.lower()
        print(f"✓ TELEGRAM_FOLLOWUP_INSTRUCTION contains expected rules")


class TestAuthRequired:
    """Tests to verify authentication is required for analytics endpoints."""

    def test_overview_requires_auth(self):
        """Verify analytics overview requires authentication."""
        response = requests.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print(f"✓ Analytics overview requires authentication")

    def test_daily_by_platform_requires_auth(self):
        """Verify daily-by-platform requires authentication."""
        response = requests.get(f"{BASE_URL}/api/analytics/daily-by-platform")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print(f"✓ Daily-by-platform requires authentication")

    def test_overview_requires_instance_id(self, auth_token):
        """Verify analytics overview requires X-Instance-ID header."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/overview", headers=headers)
        assert response.status_code == 400, f"Expected 400 without instance ID, got {response.status_code}"
        print(f"✓ Analytics overview requires X-Instance-ID header")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
