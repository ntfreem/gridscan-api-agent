"""
Test V2 Phase 5 API endpoints:
- Platform Admin: /api/v2/platform/stats, /workspaces, /provider-apps
- Suggestions: GET /api/v2/orgs/{org_id}/bots/{bot_id}/suggestions
- Suggestions: PATCH /api/v2/orgs/{org_id}/bots/{bot_id}/suggestions/{id}
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"
ORG_ID = "cb91e73c-b74b-45a3-aecc-f7823ee07d2c"
BOT_ID = "f014cae7-788f-447c-b524-7d72709daa80"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    data = response.json()
    return data.get("token")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token and org ID."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Org-ID": ORG_ID,
        "Content-Type": "application/json"
    }


class TestPlatformStats:
    """Test /api/v2/platform/stats endpoint."""

    def test_platform_stats_returns_counts(self, headers):
        """Platform stats should return org/bot/account/connection/user/suggestion counts."""
        response = requests.get(f"{BASE_URL}/api/v2/platform/stats", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify all expected fields are present
        assert "orgs" in data, "Missing 'orgs' count"
        assert "bots" in data, "Missing 'bots' count"
        assert "accounts" in data, "Missing 'accounts' count"
        assert "connections" in data, "Missing 'connections' count"
        assert "users" in data, "Missing 'users' count"
        assert "suggestions" in data, "Missing 'suggestions' count"
        assert "mode_breakdown" in data, "Missing 'mode_breakdown'"
        
        # Verify counts are integers
        assert isinstance(data["orgs"], int)
        assert isinstance(data["bots"], int)
        assert isinstance(data["accounts"], int)
        assert isinstance(data["connections"], int)
        assert isinstance(data["users"], int)
        assert isinstance(data["suggestions"], int)
        
        print(f"Platform stats: orgs={data['orgs']}, bots={data['bots']}, accounts={data['accounts']}, connections={data['connections']}, suggestions={data['suggestions']}")
        print(f"Mode breakdown: {data.get('mode_breakdown', {})}")


class TestWorkspaces:
    """Test /api/v2/platform/workspaces endpoints."""

    def test_list_workspaces_returns_orgs(self, headers):
        """List workspaces should return all organisations with stats."""
        response = requests.get(f"{BASE_URL}/api/v2/platform/workspaces", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "workspaces" in data, "Missing 'workspaces' key"
        workspaces = data["workspaces"]
        assert isinstance(workspaces, list), "Workspaces should be a list"
        assert len(workspaces) >= 1, "Should have at least 1 workspace"
        
        # Verify workspace structure
        ws = workspaces[0]
        assert "id" in ws, "Workspace missing 'id'"
        assert "name" in ws, "Workspace missing 'name'"
        assert "bot_count" in ws, "Workspace missing 'bot_count'"
        assert "account_count" in ws, "Workspace missing 'account_count'"
        assert "connection_count" in ws, "Workspace missing 'connection_count'"
        assert "member_count" in ws, "Workspace missing 'member_count'"
        
        print(f"Found {len(workspaces)} workspaces")
        for ws in workspaces[:3]:
            print(f"  - {ws['name']}: {ws['bot_count']} bots, {ws['account_count']} accounts, {ws['member_count']} members")

    def test_workspace_detail_returns_members_bots_accounts(self, headers):
        """Workspace detail should return members, bots, and accounts."""
        response = requests.get(f"{BASE_URL}/api/v2/platform/workspaces/{ORG_ID}/detail", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "org" in data, "Missing 'org' key"
        assert "bots" in data, "Missing 'bots' key"
        assert "accounts" in data, "Missing 'accounts' key"
        assert "members" in data, "Missing 'members' key"
        
        # Verify org structure
        org = data["org"]
        assert org["id"] == ORG_ID, "Org ID mismatch"
        
        # Verify members have role badges
        members = data["members"]
        if members:
            member = members[0]
            assert "id" in member, "Member missing 'id'"
            assert "org_role" in member, "Member missing 'org_role'"
            member_strs = [f"{m.get('username', m.get('email'))} ({m['org_role']})" for m in members]
            print(f"Members: {member_strs}")
        
        # Verify bots
        bots = data["bots"]
        print(f"Bots: {[b['name'] for b in bots]}")
        
        # Verify accounts have status
        accounts = data["accounts"]
        if accounts:
            acc = accounts[0]
            assert "provider" in acc, "Account missing 'provider'"
            assert "status" in acc, "Account missing 'status'"
            acc_strs = [f"{a['name']} ({a['provider']}, {a['status']})" for a in accounts[:5]]
            print(f"Accounts: {acc_strs}")


class TestProviderApps:
    """Test /api/v2/platform/provider-apps endpoint."""

    def test_provider_apps_returns_discord_telegram_zendesk(self, headers):
        """Provider apps should return stats for Discord, Telegram, Zendesk."""
        response = requests.get(f"{BASE_URL}/api/v2/platform/provider-apps", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "providers" in data, "Missing 'providers' key"
        providers = data["providers"]
        assert isinstance(providers, list), "Providers should be a list"
        assert len(providers) == 3, f"Expected 3 providers, got {len(providers)}"
        
        # Verify all three providers are present
        provider_names = [p["provider"] for p in providers]
        assert "discord" in provider_names, "Missing Discord provider"
        assert "telegram" in provider_names, "Missing Telegram provider"
        assert "zendesk" in provider_names, "Missing Zendesk provider"
        
        # Verify provider structure
        for prov in providers:
            assert "provider" in prov, "Provider missing 'provider' key"
            assert "accounts" in prov, "Provider missing 'accounts' stats"
            assert "connections" in prov, "Provider missing 'connections' stats"
            
            accts = prov["accounts"]
            assert "connected" in accts or "total" in accts, "Accounts missing count fields"
            
            conns = prov["connections"]
            assert "enabled" in conns or "total" in conns, "Connections missing count fields"
            
            print(f"{prov['provider']}: accounts={accts}, connections={conns}")


class TestSuggestionsList:
    """Test GET /api/v2/orgs/{org_id}/bots/{bot_id}/suggestions endpoint."""

    def test_list_suggestions_returns_data(self, headers):
        """List suggestions should return suggestions with connection enrichment."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/suggestions",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "suggestions" in data, "Missing 'suggestions' key"
        assert "total" in data, "Missing 'total' key"
        
        suggestions = data["suggestions"]
        total = data["total"]
        print(f"Found {total} total suggestions, returned {len(suggestions)}")
        
        # If there are suggestions, verify structure
        if suggestions:
            s = suggestions[0]
            assert "user_message" in s, "Suggestion missing 'user_message'"
            assert "ai_suggestion" in s, "Suggestion missing 'ai_suggestion'"
            assert "status" in s, "Suggestion missing 'status'"
            assert "connection_name" in s, "Suggestion missing 'connection_name' (enrichment)"
            assert "provider" in s, "Suggestion missing 'provider' (enrichment)"
            
            print(f"Sample suggestion: status={s['status']}, connection={s['connection_name']}, provider={s['provider']}")

    def test_list_suggestions_filter_by_status_pending(self, headers):
        """Filter suggestions by status=pending."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/suggestions?status=pending",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        suggestions = data["suggestions"]
        
        # All returned suggestions should be pending
        for s in suggestions:
            assert s["status"] == "pending", f"Expected pending status, got {s['status']}"
        
        print(f"Found {len(suggestions)} pending suggestions")

    def test_list_suggestions_filter_by_status_accepted(self, headers):
        """Filter suggestions by status=accepted."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/suggestions?status=accepted",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        suggestions = data["suggestions"]
        
        # All returned suggestions should be accepted
        for s in suggestions:
            assert s["status"] == "accepted", f"Expected accepted status, got {s['status']}"
        
        print(f"Found {len(suggestions)} accepted suggestions")


class TestSuggestionsUpdate:
    """Test PATCH /api/v2/orgs/{org_id}/bots/{bot_id}/suggestions/{id} endpoint."""

    def test_update_suggestion_status_accept_dismiss_cycle(self, headers):
        """Test accepting and dismissing a suggestion."""
        # First, get a pending suggestion
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/suggestions?status=pending",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        suggestions = data["suggestions"]
        
        if not suggestions:
            # Try to get any suggestion to test with
            response = requests.get(
                f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/suggestions",
                headers=headers
            )
            data = response.json()
            suggestions = data["suggestions"]
        
        if not suggestions:
            pytest.skip("No suggestions available to test update")
        
        # Get the suggestion ID (MongoDB ObjectId)
        suggestion = suggestions[0]
        suggestion_id = suggestion.get("_id") or suggestion.get("id")
        original_status = suggestion["status"]
        
        print(f"Testing with suggestion ID: {suggestion_id}, original status: {original_status}")
        
        # Test accepting the suggestion
        new_status = "accepted" if original_status != "accepted" else "dismissed"
        response = requests.patch(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/suggestions/{suggestion_id}",
            headers=headers,
            json={"status": new_status}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("ok") == True, "Expected ok=True"
        assert result.get("status") == new_status, f"Expected status={new_status}"
        
        print(f"Successfully updated suggestion to status: {new_status}")
        
        # Restore original status
        response = requests.patch(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/suggestions/{suggestion_id}",
            headers=headers,
            json={"status": original_status}
        )
        assert response.status_code == 200, f"Failed to restore status: {response.text}"
        print(f"Restored suggestion to original status: {original_status}")

    def test_update_suggestion_invalid_status_returns_400(self, headers):
        """Invalid status should return 400."""
        # Get any suggestion
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/suggestions",
            headers=headers
        )
        data = response.json()
        suggestions = data["suggestions"]
        
        if not suggestions:
            pytest.skip("No suggestions available to test")
        
        suggestion_id = suggestions[0].get("_id") or suggestions[0].get("id")
        
        # Try invalid status
        response = requests.patch(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/suggestions/{suggestion_id}",
            headers=headers,
            json={"status": "invalid_status"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid status, got {response.status_code}"
        print("Correctly rejected invalid status with 400")


class TestLegacyV2Endpoints:
    """Verify existing V2 endpoints still work."""

    def test_v2_orgs_still_works(self, headers):
        """GET /api/v2/orgs should still work."""
        response = requests.get(f"{BASE_URL}/api/v2/orgs", headers=headers)
        assert response.status_code == 200, f"V2 orgs failed: {response.status_code}"
        data = response.json()
        assert "orgs" in data or "organisations" in data or isinstance(data, list), "Invalid orgs response"
        print("V2 orgs endpoint working")

    def test_v2_bots_still_works(self, headers):
        """GET /api/v2/orgs/{org_id}/bots should still work."""
        response = requests.get(f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots", headers=headers)
        assert response.status_code == 200, f"V2 bots failed: {response.status_code}"
        data = response.json()
        assert "bots" in data, "Invalid bots response"
        print(f"V2 bots endpoint working, found {len(data['bots'])} bots")

    def test_v2_accounts_still_works(self, headers):
        """GET /api/v2/orgs/{org_id}/accounts should still work."""
        response = requests.get(f"{BASE_URL}/api/v2/orgs/{ORG_ID}/accounts", headers=headers)
        assert response.status_code == 200, f"V2 accounts failed: {response.status_code}"
        data = response.json()
        assert "accounts" in data, "Invalid accounts response"
        print(f"V2 accounts endpoint working, found {len(data['accounts'])} accounts")

    def test_v2_connections_still_works(self, headers):
        """GET /api/v2/orgs/{org_id}/bots/{bot_id}/connections should still work."""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{ORG_ID}/bots/{BOT_ID}/connections",
            headers=headers
        )
        assert response.status_code == 200, f"V2 connections failed: {response.status_code}"
        data = response.json()
        assert "connections" in data, "Invalid connections response"
        print(f"V2 connections endpoint working, found {len(data['connections'])} connections")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
