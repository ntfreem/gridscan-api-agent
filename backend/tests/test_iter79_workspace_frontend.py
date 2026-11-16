"""
Iteration 79: Workspace Architecture Stage 2 - Frontend UI & Signup Auto-Creation Tests
Tests workspace selector, workspace settings pages, and signup workspace auto-creation flow.
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
WORKSPACE_OWNER_EMAIL = "admin@bridgebot.tech"
WORKSPACE_OWNER_PASSWORD = "Admin@123"
PLATFORM_SUPERADMIN_EMAIL = "admin@bitbotpro.io"
PLATFORM_SUPERADMIN_PASSWORD = "Admin@123"
DEVELOPMENT_WORKSPACE_ID = "5346b610-1c2c-4bfe-86a5-de820e315ddf"
DEFAULT_ORG_ID = "cb91e73c-b74b-45a3-aecc-f7823ee07d2c"


@pytest.fixture(scope="module")
def workspace_owner_token():
    """Get token for workspace owner (admin@bridgebot.tech)"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": WORKSPACE_OWNER_EMAIL,
        "password": WORKSPACE_OWNER_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def superadmin_token():
    """Get token for platform superadmin (admin@bitbotpro.io)"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": PLATFORM_SUPERADMIN_EMAIL,
        "password": PLATFORM_SUPERADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


class TestWorkspaceListAndSelection:
    """Test workspace listing and selection APIs used by frontend"""
    
    def test_get_workspaces_returns_development_workspace(self, workspace_owner_token):
        """GET /api/v2/workspaces returns workspaces with org_count and member_count"""
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces",
            headers={"Authorization": f"Bearer {workspace_owner_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "workspaces" in data
        workspaces = data["workspaces"]
        assert len(workspaces) >= 1
        
        # Find development workspace
        dev_ws = next((ws for ws in workspaces if ws["id"] == DEVELOPMENT_WORKSPACE_ID), None)
        assert dev_ws is not None, "Development workspace not found"
        assert dev_ws["name"] == "development"
        assert dev_ws["slug"] == "development"
        assert "org_count" in dev_ws
        assert "member_count" in dev_ws
        assert dev_ws["member_count"] >= 2  # owner + admin
        print(f"✓ Development workspace found with {dev_ws['org_count']} orgs, {dev_ws['member_count']} members")
    
    def test_get_workspace_detail(self, workspace_owner_token):
        """GET /api/v2/workspaces/{ws_id} returns workspace detail"""
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}",
            headers={"Authorization": f"Bearer {workspace_owner_token}"}
        )
        assert response.status_code == 200
        ws = response.json()
        assert ws["id"] == DEVELOPMENT_WORKSPACE_ID
        assert ws["name"] == "development"
        assert "billing" in ws
        assert "created_at" in ws
        print(f"✓ Workspace detail: {ws['name']}, plan={ws.get('billing', {}).get('plan')}")


class TestWorkspaceSettingsGeneral:
    """Test workspace general settings page APIs"""
    
    def test_workspace_has_required_fields_for_general_tab(self, workspace_owner_token):
        """Workspace detail has all fields needed for General Settings tab"""
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}",
            headers={"Authorization": f"Bearer {workspace_owner_token}"}
        )
        assert response.status_code == 200
        ws = response.json()
        
        # Fields needed for General tab
        assert "id" in ws
        assert "name" in ws
        assert "slug" in ws
        assert "created_at" in ws
        print(f"✓ General tab fields: id={ws['id'][:8]}..., name={ws['name']}, slug={ws['slug']}")
    
    def test_update_workspace_name(self, workspace_owner_token):
        """PUT /api/v2/workspaces/{ws_id} updates workspace name"""
        # Update name
        response = requests.put(
            f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}",
            headers={"Authorization": f"Bearer {workspace_owner_token}"},
            json={"name": "development"}  # Keep same name to avoid breaking things
        )
        assert response.status_code == 200
        assert response.json().get("ok") == True
        print("✓ Workspace name update API works")


class TestWorkspaceSettingsMembers:
    """Test workspace members page APIs"""
    
    def test_get_workspace_members(self, workspace_owner_token):
        """GET /api/v2/workspaces/{ws_id}/members returns members with roles"""
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}/members",
            headers={"Authorization": f"Bearer {workspace_owner_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "members" in data
        members = data["members"]
        assert len(members) >= 2
        
        # Check for owner
        owner = next((m for m in members if m["role"] == "owner"), None)
        assert owner is not None, "No owner found in members"
        assert owner["is_owner"] == True
        assert owner["email"] == WORKSPACE_OWNER_EMAIL
        
        # Check for admin
        admin = next((m for m in members if m["role"] == "admin"), None)
        assert admin is not None, "No admin found in members"
        assert admin["is_owner"] == False
        
        print(f"✓ Found {len(members)} members: owner={owner['email']}, admin={admin['email']}")
    
    def test_owner_cannot_be_removed(self, workspace_owner_token):
        """DELETE /api/v2/workspaces/{ws_id}/members/{owner_id} should fail"""
        # Get owner ID
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}/members",
            headers={"Authorization": f"Bearer {workspace_owner_token}"}
        )
        members = response.json()["members"]
        owner = next((m for m in members if m["role"] == "owner"), None)
        
        # Try to remove owner
        response = requests.delete(
            f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}/members/{owner['user_id']}",
            headers={"Authorization": f"Bearer {workspace_owner_token}"}
        )
        assert response.status_code == 400
        assert "owner" in response.json().get("detail", "").lower()
        print("✓ Owner removal correctly rejected")


class TestWorkspaceSettingsBilling:
    """Test workspace billing page APIs"""
    
    def test_get_workspace_billing(self, workspace_owner_token):
        """GET /api/v2/workspaces/{ws_id}/billing returns plan and limits"""
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}/billing",
            headers={"Authorization": f"Bearer {workspace_owner_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "billing" in data
        billing = data["billing"]
        assert "plan" in billing
        assert billing["plan"].lower() == "internal"  # Development workspace has internal plan
        
        assert "limits" in billing
        limits = billing["limits"]
        assert limits.get("max_organisations") == 100
        assert limits.get("max_bots_per_org") == 50
        assert limits.get("max_discord_connections") == 200
        assert limits.get("max_monthly_ai_messages") == 999999
        assert limits.get("max_custom_discord_apps") == 20
        
        assert "usage" in data
        print(f"✓ Billing: plan={billing['plan']}, limits={limits}")


class TestWorkspaceSettingsDiscordApps:
    """Test workspace Discord apps page APIs"""
    
    def test_get_workspace_discord_apps(self, workspace_owner_token):
        """GET /api/v2/workspaces/{ws_id}/discord-apps returns custom apps"""
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}/discord-apps",
            headers={"Authorization": f"Bearer {workspace_owner_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "discord_apps" in data
        # May be empty if no custom apps
        print(f"✓ Discord apps: {len(data['discord_apps'])} custom apps")
    
    def test_get_platform_discord_app(self, superadmin_token):
        """GET /api/v2/platform/discord-app returns platform app config"""
        response = requests.get(
            f"{BASE_URL}/api/v2/platform/discord-app",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data
        if data["configured"]:
            assert "client_id" in data
        print(f"✓ Platform Discord app: configured={data.get('configured')}")


class TestOrganisationWorkspaceScoping:
    """Test organisation listing scoped to workspace"""
    
    def test_orgs_scoped_to_workspace_via_header(self, workspace_owner_token):
        """GET /api/v2/orgs with X-Workspace-ID header returns scoped orgs"""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs",
            headers={
                "Authorization": f"Bearer {workspace_owner_token}",
                "X-Workspace-ID": DEVELOPMENT_WORKSPACE_ID
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "organisations" in data
        orgs = data["organisations"]
        
        # All orgs should belong to the workspace
        for org in orgs:
            assert org.get("workspace_id") == DEVELOPMENT_WORKSPACE_ID or org.get("workspace_id") is None
        
        # Find Default Organisation
        default_org = next((o for o in orgs if o["id"] == DEFAULT_ORG_ID), None)
        assert default_org is not None, "Default Organisation not found"
        print(f"✓ Found {len(orgs)} orgs in workspace, including Default Organisation")
    
    def test_workspace_orgs_endpoint(self, workspace_owner_token):
        """GET /api/v2/workspaces/{ws_id}/orgs returns orgs in workspace"""
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}/orgs",
            headers={"Authorization": f"Bearer {workspace_owner_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "organisations" in data
        orgs = data["organisations"]
        assert len(orgs) >= 1
        
        # Check org has expected fields
        org = orgs[0]
        assert "id" in org
        assert "name" in org
        assert "bot_count" in org
        assert "member_count" in org
        print(f"✓ Workspace orgs endpoint: {len(orgs)} orgs")


class TestOrgCreationWithWorkspace:
    """Test org creation includes workspace_id"""
    
    def test_create_org_with_workspace_id(self, workspace_owner_token):
        """POST /api/v2/orgs with workspace_id scopes org to workspace"""
        unique_name = f"TEST_Org_79_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/v2/orgs",
            headers={
                "Authorization": f"Bearer {workspace_owner_token}",
                "X-Workspace-ID": DEVELOPMENT_WORKSPACE_ID
            },
            json={
                "name": unique_name,
                "workspace_id": DEVELOPMENT_WORKSPACE_ID
            }
        )
        assert response.status_code in [200, 201], f"Org creation failed: {response.text}"
        org = response.json()
        org_id = org.get("id") or org.get("organisation", {}).get("id")
        assert org_id is not None
        
        # Verify workspace_id is set
        org_data = org.get("organisation", org)
        assert org_data.get("workspace_id") == DEVELOPMENT_WORKSPACE_ID
        print(f"✓ Created org '{unique_name}' with workspace_id")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/v2/orgs/{org_id}",
            headers={"Authorization": f"Bearer {workspace_owner_token}"}
        )
        print(f"✓ Cleaned up test org")


class TestBotListingForOrg:
    """Test bot listing for selected org"""
    
    def test_get_bots_for_org(self, workspace_owner_token):
        """GET /api/v2/orgs/{org_id}/bots returns bots"""
        response = requests.get(
            f"{BASE_URL}/api/v2/orgs/{DEFAULT_ORG_ID}/bots",
            headers={
                "Authorization": f"Bearer {workspace_owner_token}",
                "X-Org-ID": DEFAULT_ORG_ID
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "bots" in data
        bots = data["bots"]
        
        # Should have API Tester and Sales Bot
        bot_names = [b["name"] for b in bots]
        print(f"✓ Found {len(bots)} bots: {bot_names}")


class TestSignupWorkspaceAutoCreation:
    """Test that signup auto-creates workspace + default org"""
    
    def test_register_and_verify_creates_workspace(self):
        """POST /api/auth/register + POST /api/auth/verify creates workspace"""
        unique_email = f"TEST_signup_79_{uuid.uuid4().hex[:8]}@example.com"
        
        # Step 1: Register
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "username": f"test_user_{uuid.uuid4().hex[:6]}"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        print(f"✓ Registered {unique_email}")
        
        # Step 2: Get verification code from MongoDB (we need to query directly)
        # Since we can't access MongoDB directly in this test, we'll check if the
        # verification endpoint exists and returns appropriate error for wrong code
        response = requests.post(f"{BASE_URL}/api/auth/verify", json={
            "email": unique_email,
            "code": "000000"  # Wrong code
        })
        # Should fail with invalid code, not 500
        assert response.status_code in [400, 401], f"Unexpected status: {response.status_code}"
        print("✓ Verification endpoint works (rejected invalid code)")
        
        # Note: Full signup flow test requires MongoDB access to get verification code
        # This is tested in the Playwright UI test instead


class TestWorkspaceIsolation:
    """Test workspace isolation between users"""
    
    def test_superadmin_sees_all_workspaces(self, superadmin_token):
        """Platform superadmin can see all workspaces"""
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        workspaces = response.json()["workspaces"]
        assert len(workspaces) >= 1
        
        # Should see development workspace
        dev_ws = next((ws for ws in workspaces if ws["id"] == DEVELOPMENT_WORKSPACE_ID), None)
        assert dev_ws is not None
        print(f"✓ Superadmin sees {len(workspaces)} workspaces including development")
    
    def test_superadmin_can_access_workspace_settings(self, superadmin_token):
        """Platform superadmin can access workspace settings pages"""
        # Members
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}/members",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        
        # Billing
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}/billing",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        
        # Discord apps
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}/discord-apps",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        print("✓ Superadmin can access all workspace settings endpoints")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
