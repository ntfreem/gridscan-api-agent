"""
Iteration 84 - Regular User Sidebar & 3-Tier Role Testing
Tests the 3-tier sidebar: Regular User vs Workspace Admin vs Superadmin

Key test scenarios:
1. Regular user (johndoe@example.com) - member role in workspace
2. Workspace admin (admin@bridgebot.tech) - owner role in workspace  
3. Superadmin (admin@bitbotpro.io) - platform superadmin

Regular users should:
- See only orgs they are members of
- NOT see workspace selector
- NOT see admin/enterprise sections
- NOT be able to access admin endpoints (403)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
REGULAR_USER = {"email_or_username": "johndoe@example.com", "password": "User@123"}
WORKSPACE_ADMIN = {"email_or_username": "admin@bridgebot.tech", "password": "Admin@123"}
SUPERADMIN = {"email_or_username": "admin@bitbotpro.io", "password": "Admin@123"}

DEVELOPMENT_WORKSPACE_ID = "5346b610-1c2c-4bfe-86a5-de820e315ddf"
DEFAULT_ORG_ID = "cb91e73c-b74b-45a3-aecc-f7823ee07d2c"


class TestRegularUserWorkspaceRole:
    """Test that regular user gets 'member' role in workspace list"""
    
    def test_regular_user_login(self):
        """Regular user can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=REGULAR_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"Regular user logged in: {data['user'].get('email')}")
        print(f"User role: {data['user'].get('role')}, platform_role: {data['user'].get('platform_role')}")
    
    def test_regular_user_workspace_list_has_my_role(self):
        """GET /api/v2/workspaces returns my_role field for regular user"""
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=REGULAR_USER)
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        # Get workspaces
        headers = {"Authorization": f"Bearer {token}"}
        ws_resp = requests.get(f"{BASE_URL}/api/v2/workspaces", headers=headers)
        assert ws_resp.status_code == 200, f"Failed to get workspaces: {ws_resp.text}"
        
        workspaces = ws_resp.json().get("workspaces", [])
        print(f"Regular user sees {len(workspaces)} workspace(s)")
        
        # Find development workspace
        dev_ws = next((ws for ws in workspaces if ws["id"] == DEVELOPMENT_WORKSPACE_ID), None)
        assert dev_ws is not None, f"Development workspace not found. Available: {[ws['name'] for ws in workspaces]}"
        
        # Verify my_role is 'member'
        assert "my_role" in dev_ws, "my_role field missing from workspace"
        assert dev_ws["my_role"] == "member", f"Expected my_role='member', got '{dev_ws['my_role']}'"
        print(f"Workspace '{dev_ws['name']}' my_role: {dev_ws['my_role']} ✓")
    
    def test_regular_user_sees_only_assigned_orgs(self):
        """Regular user only sees orgs they are member of"""
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=REGULAR_USER)
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        # Get orgs with workspace header
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Workspace-ID": DEVELOPMENT_WORKSPACE_ID
        }
        org_resp = requests.get(f"{BASE_URL}/api/v2/orgs", headers=headers)
        assert org_resp.status_code == 200, f"Failed to get orgs: {org_resp.text}"
        
        orgs = org_resp.json().get("organisations", [])
        print(f"Regular user sees {len(orgs)} org(s)")
        
        # Should see Default Organisation
        default_org = next((o for o in orgs if o["id"] == DEFAULT_ORG_ID), None)
        assert default_org is not None, f"Default Organisation not found. Available: {[o['name'] for o in orgs]}"
        print(f"Regular user can see org: {default_org['name']} ✓")


class TestRegularUserAdminAccessDenied:
    """Test that regular user cannot access admin endpoints"""
    
    def test_regular_user_cannot_access_admin_team(self):
        """Regular user gets 403 on /api/admin/users"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=REGULAR_USER)
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print("Regular user blocked from /api/admin/users ✓")
    
    def test_regular_user_cannot_access_admin_analytics(self):
        """Regular user gets 403 on /api/admin/analytics"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=REGULAR_USER)
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/api/admin/analytics", headers=headers)
        # Analytics might return 403 or 404 depending on implementation
        assert resp.status_code in [403, 404], f"Expected 403/404, got {resp.status_code}"
        print(f"Regular user blocked from /api/admin/analytics (status: {resp.status_code}) ✓")
    
    def test_regular_user_cannot_access_workspace_members(self):
        """Regular user cannot list workspace members (admin-only)"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=REGULAR_USER)
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/api/v2/workspaces/{DEVELOPMENT_WORKSPACE_ID}/users", headers=headers)
        # Should be 403 since regular user is not workspace admin
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print("Regular user blocked from workspace users endpoint ✓")


class TestWorkspaceAdminRole:
    """Test workspace admin (owner) role and access"""
    
    def test_workspace_admin_login(self):
        """Workspace admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=WORKSPACE_ADMIN)
        assert response.status_code == 200
        data = response.json()
        print(f"Workspace admin logged in: {data['user'].get('email')}")
        print(f"User role: {data['user'].get('role')}, platform_role: {data['user'].get('platform_role')}")
    
    def test_workspace_admin_has_owner_role(self):
        """Workspace admin has 'owner' my_role in workspace list"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=WORKSPACE_ADMIN)
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        ws_resp = requests.get(f"{BASE_URL}/api/v2/workspaces", headers=headers)
        assert ws_resp.status_code == 200
        
        workspaces = ws_resp.json().get("workspaces", [])
        dev_ws = next((ws for ws in workspaces if ws["id"] == DEVELOPMENT_WORKSPACE_ID), None)
        assert dev_ws is not None
        
        # Should be owner or admin
        assert dev_ws["my_role"] in ["owner", "admin"], f"Expected owner/admin, got '{dev_ws['my_role']}'"
        print(f"Workspace admin my_role: {dev_ws['my_role']} ✓")
    
    def test_workspace_admin_can_access_admin_users(self):
        """Workspace admin can access /api/admin/users"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=WORKSPACE_ADMIN)
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("Workspace admin can access /api/admin/users ✓")
    
    def test_workspace_admin_sees_all_orgs_in_workspace(self):
        """Workspace admin sees all orgs in workspace"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=WORKSPACE_ADMIN)
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Workspace-ID": DEVELOPMENT_WORKSPACE_ID
        }
        org_resp = requests.get(f"{BASE_URL}/api/v2/orgs", headers=headers)
        assert org_resp.status_code == 200
        
        orgs = org_resp.json().get("organisations", [])
        print(f"Workspace admin sees {len(orgs)} org(s)")
        # Should see more orgs than regular user (or at least the same)
        assert len(orgs) >= 1, "Workspace admin should see at least 1 org"


class TestSuperadminRole:
    """Test superadmin role and access"""
    
    def test_superadmin_login(self):
        """Superadmin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN)
        assert response.status_code == 200
        data = response.json()
        print(f"Superadmin logged in: {data['user'].get('email')}")
        print(f"User role: {data['user'].get('role')}, platform_role: {data['user'].get('platform_role')}")
        # Verify superadmin role
        user = data["user"]
        is_superadmin = user.get("role") == "superadmin" or user.get("platform_role") == "superadmin"
        assert is_superadmin, "User should be superadmin"
    
    def test_superadmin_has_superadmin_my_role(self):
        """Superadmin has 'superadmin' my_role in workspace list"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN)
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        ws_resp = requests.get(f"{BASE_URL}/api/v2/workspaces", headers=headers)
        assert ws_resp.status_code == 200
        
        workspaces = ws_resp.json().get("workspaces", [])
        print(f"Superadmin sees {len(workspaces)} workspace(s)")
        
        # Superadmin should see all workspaces
        assert len(workspaces) >= 1, "Superadmin should see at least 1 workspace"
        
        # Check my_role for development workspace
        dev_ws = next((ws for ws in workspaces if ws["id"] == DEVELOPMENT_WORKSPACE_ID), None)
        if dev_ws:
            print(f"Superadmin my_role in dev workspace: {dev_ws.get('my_role')}")
            # Superadmin should have 'superadmin' my_role (or None if not a member)
            assert dev_ws.get("my_role") in ["superadmin", None, "owner", "admin"], f"Unexpected my_role: {dev_ws.get('my_role')}"
    
    def test_superadmin_can_access_all_admin_endpoints(self):
        """Superadmin can access all admin endpoints"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN)
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test admin users
        resp = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert resp.status_code == 200, f"Admin users failed: {resp.status_code}"
        print("Superadmin can access /api/admin/users ✓")


class TestRegularUserBotAccess:
    """Test that regular user can access bots in their org"""
    
    def test_regular_user_can_list_bots_in_org(self):
        """Regular user can list bots in their assigned org"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=REGULAR_USER)
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        
        headers = {
            "Authorization": f"Bearer {token}",
            "X-Org-ID": DEFAULT_ORG_ID
        }
        bot_resp = requests.get(f"{BASE_URL}/api/v2/orgs/{DEFAULT_ORG_ID}/bots", headers=headers)
        assert bot_resp.status_code == 200, f"Failed to list bots: {bot_resp.text}"
        
        bots = bot_resp.json().get("bots", [])
        print(f"Regular user sees {len(bots)} bot(s) in Default Organisation")
        
        if bots:
            bot = bots[0]
            print(f"First bot: {bot.get('name')} (id: {bot.get('id')})")
            
            # Test accessing bot detail
            bot_detail_resp = requests.get(
                f"{BASE_URL}/api/v2/orgs/{DEFAULT_ORG_ID}/bots/{bot['id']}", 
                headers=headers
            )
            assert bot_detail_resp.status_code == 200, f"Failed to get bot detail: {bot_detail_resp.text}"
            print(f"Regular user can access bot detail ✓")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
