"""
Iteration 86 - Zendesk P0 Bug Fix Tests
Tests the fix for 'No Zendesk connection found' error when clicking Test button.

Root cause: selectBot() in AuthContext.js wasn't creating a synthetic instance
when bot had legacy_instance_id but that ID wasn't in user's instances array.

Key IDs:
- API Tester bot V2 ID: f014cae7-788f-447c-b524-7d72709daa80
- API Tester legacy_instance_id: 88bfae82-2533-4235-968d-b3298fd57073
- zendesk_config is keyed on legacy instance ID
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "admin@bitbotpro.io"
SUPERADMIN_PASSWORD = "Admin@123"
WORKSPACE_OWNER_EMAIL = "admin@bridgebot.tech"
WORKSPACE_OWNER_PASSWORD = "Admin@123"

# Key IDs for the P0 bug
API_TESTER_V2_BOT_ID = "f014cae7-788f-447c-b524-7d72709daa80"
API_TESTER_LEGACY_INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def superadmin_token(api_client):
    """Get superadmin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Superadmin login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture
def workspace_owner_token(api_client):
    """Get workspace owner authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": WORKSPACE_OWNER_EMAIL,
        "password": WORKSPACE_OWNER_PASSWORD
    })
    assert response.status_code == 200, f"Workspace owner login failed: {response.text}"
    return response.json().get("token")


class TestZendeskP0BugFix:
    """Tests for the Zendesk P0 bug fix - 'No Zendesk connection found' error"""

    def test_zendesk_config_with_legacy_instance_id_returns_connected(self, api_client, superadmin_token):
        """
        P0 Bug Fix Test: When using the legacy_instance_id, the Zendesk config
        should return connected=true with the correct subdomain.
        
        This is the core of the fix - the frontend should send the legacy_instance_id
        in the X-Instance-ID header, not the V2 bot ID.
        """
        response = api_client.get(
            f"{BASE_URL}/api/admin/zendesk-config",
            headers={
                "Authorization": f"Bearer {superadmin_token}",
                "X-Instance-ID": API_TESTER_LEGACY_INSTANCE_ID
            }
        )
        assert response.status_code == 200, f"Failed to get zendesk config: {response.text}"
        
        data = response.json()
        assert data["connected"] == True, f"Expected connected=true, got: {data}"
        assert data["subdomain"] == "midnight-gd", f"Expected subdomain=midnight-gd, got: {data.get('subdomain')}"
        assert data["is_active"] == True, f"Expected is_active=true, got: {data.get('is_active')}"
        assert data["instance_id"] == API_TESTER_LEGACY_INSTANCE_ID
        print(f"SUCCESS: Zendesk config with legacy instance ID shows connected to {data['subdomain']}.zendesk.com")

    def test_zendesk_config_with_v2_bot_id_returns_not_connected(self, api_client, superadmin_token):
        """
        Verify that using the V2 bot ID (not the legacy instance ID) returns
        not connected - this confirms the zendesk_config is keyed on legacy ID.
        """
        response = api_client.get(
            f"{BASE_URL}/api/admin/zendesk-config",
            headers={
                "Authorization": f"Bearer {superadmin_token}",
                "X-Instance-ID": API_TESTER_V2_BOT_ID
            }
        )
        assert response.status_code == 200, f"Failed to get zendesk config: {response.text}"
        
        data = response.json()
        assert data["connected"] == False, f"Expected connected=false for V2 bot ID, got: {data}"
        print(f"SUCCESS: Zendesk config with V2 bot ID correctly shows not connected")

    def test_zendesk_test_endpoint_with_legacy_id_does_not_return_no_connection_error(self, api_client, superadmin_token):
        """
        P0 Bug Fix Test: The Test button should NOT return 'No Zendesk connection found'.
        It may return 'Authorization Expired' (expected in test env) but NOT 'No connection'.
        """
        response = api_client.post(
            f"{BASE_URL}/api/admin/zendesk-config/test",
            headers={
                "Authorization": f"Bearer {superadmin_token}",
                "X-Instance-ID": API_TESTER_LEGACY_INSTANCE_ID
            },
            json={}
        )
        
        # The test may fail with 401 (auth expired) but should NOT fail with 400 (no connection)
        if response.status_code == 401:
            data = response.json()
            detail = data.get("detail", "")
            assert "No Zendesk connection found" not in detail, f"P0 BUG: Got 'No Zendesk connection found' error: {detail}"
            assert "expired" in detail.lower() or "reconnect" in detail.lower(), f"Expected auth expired message, got: {detail}"
            print(f"SUCCESS: Test endpoint returns 'Authorization Expired' (expected), NOT 'No connection found'")
        elif response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print(f"SUCCESS: Test endpoint returned success (connection is valid)")
        else:
            data = response.json()
            detail = data.get("detail", "")
            assert "No Zendesk connection found" not in detail, f"P0 BUG: Got 'No Zendesk connection found' error: {detail}"
            print(f"Test endpoint returned {response.status_code}: {detail}")

    def test_zendesk_test_endpoint_with_v2_bot_id_returns_no_connection(self, api_client, superadmin_token):
        """
        Verify that using V2 bot ID (wrong ID) returns 'No Zendesk connection found'.
        This confirms the bug scenario - if frontend sends wrong ID, it fails.
        """
        response = api_client.post(
            f"{BASE_URL}/api/admin/zendesk-config/test",
            headers={
                "Authorization": f"Bearer {superadmin_token}",
                "X-Instance-ID": API_TESTER_V2_BOT_ID
            },
            json={}
        )
        
        assert response.status_code == 400, f"Expected 400 for V2 bot ID, got: {response.status_code}"
        data = response.json()
        assert "No Zendesk connection found" in data.get("detail", ""), f"Expected 'No Zendesk connection found', got: {data}"
        print(f"SUCCESS: V2 bot ID correctly returns 'No Zendesk connection found' (confirms bug scenario)")

    def test_bot_has_legacy_instance_id(self, api_client, superadmin_token):
        """Verify the API Tester bot has the expected legacy_instance_id"""
        # First get the org ID
        response = api_client.get(
            f"{BASE_URL}/api/v2/orgs",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        orgs = response.json().get("organisations", [])
        assert len(orgs) > 0, "No organisations found"
        org_id = orgs[0]["id"]
        
        # Get bots for the org
        response = api_client.get(
            f"{BASE_URL}/api/v2/orgs/{org_id}/bots",
            headers={
                "Authorization": f"Bearer {superadmin_token}",
                "X-Org-ID": org_id
            }
        )
        assert response.status_code == 200
        bots = response.json().get("bots", [])
        
        # Find API Tester bot
        api_tester = next((b for b in bots if b["name"] == "API Tester"), None)
        assert api_tester is not None, "API Tester bot not found"
        assert api_tester["id"] == API_TESTER_V2_BOT_ID, f"Unexpected V2 bot ID: {api_tester['id']}"
        assert api_tester["legacy_instance_id"] == API_TESTER_LEGACY_INSTANCE_ID, f"Unexpected legacy_instance_id: {api_tester.get('legacy_instance_id')}"
        print(f"SUCCESS: API Tester bot has correct legacy_instance_id mapping")

    def test_user_instances_contain_v2_bot_id_not_legacy(self, api_client, superadmin_token):
        """
        Verify that /auth/me returns instances with V2 bot IDs, not legacy IDs.
        This confirms why the bug occurred - the instances array has V2 IDs.
        """
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        instances = data.get("instances", [])
        
        # Check that API Tester is in instances with V2 ID
        api_tester_instance = next((i for i in instances if i["name"] == "API Tester"), None)
        assert api_tester_instance is not None, "API Tester not in instances"
        assert api_tester_instance["id"] == API_TESTER_V2_BOT_ID, f"Expected V2 bot ID in instances, got: {api_tester_instance['id']}"
        
        # Verify legacy ID is NOT in instances
        legacy_in_instances = any(i["id"] == API_TESTER_LEGACY_INSTANCE_ID for i in instances)
        assert not legacy_in_instances, "Legacy instance ID should NOT be in user's instances array"
        print(f"SUCCESS: User instances contain V2 bot ID, not legacy ID (confirms bug scenario)")


class TestWorkspaceOwnerZendeskAccess:
    """Tests for workspace owner access to Zendesk settings"""

    def test_workspace_owner_can_access_zendesk_config(self, api_client, workspace_owner_token):
        """Workspace owner should be able to access Zendesk config page"""
        # First get the bots to find one with legacy_instance_id
        response = api_client.get(
            f"{BASE_URL}/api/v2/orgs",
            headers={"Authorization": f"Bearer {workspace_owner_token}"}
        )
        assert response.status_code == 200
        orgs = response.json().get("organisations", [])
        
        if len(orgs) > 0:
            org_id = orgs[0]["id"]
            response = api_client.get(
                f"{BASE_URL}/api/v2/orgs/{org_id}/bots",
                headers={
                    "Authorization": f"Bearer {workspace_owner_token}",
                    "X-Org-ID": org_id
                }
            )
            assert response.status_code == 200
            bots = response.json().get("bots", [])
            
            if len(bots) > 0:
                bot = bots[0]
                instance_id = bot.get("legacy_instance_id") or bot["id"]
                
                response = api_client.get(
                    f"{BASE_URL}/api/admin/zendesk-config",
                    headers={
                        "Authorization": f"Bearer {workspace_owner_token}",
                        "X-Instance-ID": instance_id
                    }
                )
                assert response.status_code == 200, f"Workspace owner failed to access zendesk config: {response.text}"
                print(f"SUCCESS: Workspace owner can access Zendesk config")
            else:
                pytest.skip("No bots found for workspace owner")
        else:
            pytest.skip("No organisations found for workspace owner")


class TestGeneralAppFunctionality:
    """Tests for general app functionality to verify no regressions"""

    def test_superadmin_login(self, api_client):
        """Superadmin login works"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "superadmin"
        print("SUCCESS: Superadmin login works")

    def test_workspace_owner_login(self, api_client):
        """Workspace owner login works"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": WORKSPACE_OWNER_EMAIL,
            "password": WORKSPACE_OWNER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print("SUCCESS: Workspace owner login works")

    def test_regular_user_login(self, api_client):
        """Regular user login works"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "johndoe@example.com",
            "password": "User@123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print("SUCCESS: Regular user login works")

    def test_workspaces_endpoint(self, api_client, superadmin_token):
        """Workspaces endpoint works"""
        response = api_client.get(
            f"{BASE_URL}/api/v2/workspaces",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "workspaces" in data
        print(f"SUCCESS: Workspaces endpoint returns {len(data['workspaces'])} workspaces")

    def test_orgs_endpoint(self, api_client, superadmin_token):
        """Organisations endpoint works"""
        response = api_client.get(
            f"{BASE_URL}/api/v2/orgs",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "organisations" in data
        print(f"SUCCESS: Orgs endpoint returns {len(data['organisations'])} organisations")

    def test_bots_endpoint(self, api_client, superadmin_token):
        """Bots endpoint works"""
        # Get first org
        response = api_client.get(
            f"{BASE_URL}/api/v2/orgs",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        orgs = response.json().get("organisations", [])
        
        if len(orgs) > 0:
            org_id = orgs[0]["id"]
            response = api_client.get(
                f"{BASE_URL}/api/v2/orgs/{org_id}/bots",
                headers={
                    "Authorization": f"Bearer {superadmin_token}",
                    "X-Org-ID": org_id
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert "bots" in data
            print(f"SUCCESS: Bots endpoint returns {len(data['bots'])} bots")
        else:
            pytest.skip("No organisations found")
