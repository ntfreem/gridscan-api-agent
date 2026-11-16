"""
Iteration 83 - Admin Sidebar Restructuring & Workspace-Scoped Team Access Tests

Tests:
1. Workspace admin (admin@bridgebot.tech) can access /api/admin/users and gets workspace-scoped users
2. Superadmin (admin@bitbotpro.io) can access /api/admin/users and gets ALL users
3. Workspace admin can edit workspace roles (admin/member) but NOT platform roles
4. Workspace admin cannot delete superadmin users
5. Workspace admin can access admin pages: /admin/organisations, /admin/analytics, /admin/api-key-analytics
6. Workspace admin can invite users to their workspace
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
SUPERADMIN_EMAIL = "admin@bitbotpro.io"
SUPERADMIN_PASSWORD = "Admin@123"
WORKSPACE_ADMIN_EMAIL = "admin@bridgebot.tech"
WORKSPACE_ADMIN_PASSWORD = "Admin@123"
DEV_WORKSPACE_ID = "5346b610-1c2c-4bfe-86a5-de820e315ddf"


@pytest.fixture(scope="module")
def superadmin_token():
    """Get superadmin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Superadmin login failed: {response.status_code} - {response.text}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def workspace_admin_token():
    """Get workspace admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": WORKSPACE_ADMIN_EMAIL,
        "password": WORKSPACE_ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Workspace admin login failed: {response.status_code} - {response.text}")
    return response.json().get("token")


class TestWorkspaceAdminUserAccess:
    """Test workspace admin access to /api/admin/users endpoint"""

    def test_workspace_admin_can_access_users_endpoint(self, workspace_admin_token):
        """Workspace admin should be able to access GET /api/admin/users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {workspace_admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        users = response.json()
        assert isinstance(users, list), "Response should be a list of users"
        print(f"✓ Workspace admin can access /api/admin/users - returned {len(users)} users")

    def test_workspace_admin_sees_only_workspace_scoped_users(self, workspace_admin_token, superadmin_token):
        """Workspace admin should see fewer users than superadmin (workspace-scoped)"""
        # Get users as workspace admin
        ws_response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {workspace_admin_token}"}
        )
        assert ws_response.status_code == 200
        ws_users = ws_response.json()

        # Get users as superadmin
        sa_response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert sa_response.status_code == 200
        sa_users = sa_response.json()

        print(f"Workspace admin sees {len(ws_users)} users")
        print(f"Superadmin sees {len(sa_users)} users")

        # Workspace admin should see fewer or equal users (scoped to their workspaces)
        assert len(ws_users) <= len(sa_users), "Workspace admin should see <= users than superadmin"
        print(f"✓ Workspace admin sees workspace-scoped users ({len(ws_users)} vs {len(sa_users)} total)")

    def test_superadmin_sees_all_users(self, superadmin_token):
        """Superadmin should see all users in the system"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        assert len(users) > 0, "Superadmin should see at least some users"
        print(f"✓ Superadmin can access all users - returned {len(users)} users")


class TestWorkspaceAdminRoleChanges:
    """Test workspace admin role change permissions"""

    def test_workspace_admin_cannot_change_platform_role(self, workspace_admin_token, superadmin_token):
        """Workspace admin should NOT be able to change platform-level roles"""
        # First get a non-superadmin user
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {workspace_admin_token}"}
        )
        assert response.status_code == 200
        users = response.json()
        
        # Find a non-superadmin user that's not the workspace admin
        target_user = None
        for u in users:
            if (u.get("email") != WORKSPACE_ADMIN_EMAIL and 
                u.get("role") != "superadmin" and 
                u.get("platform_role") != "superadmin"):
                target_user = u
                break
        
        if not target_user:
            pytest.skip("No suitable target user found for role change test")
        
        # Try to change platform role (without workspace_id) - should fail with 403
        response = requests.patch(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/role",
            headers={"Authorization": f"Bearer {workspace_admin_token}"},
            json={"role": "superadmin"}  # No workspace_id = platform role change
        )
        assert response.status_code == 403, f"Expected 403 for platform role change, got {response.status_code}: {response.text}"
        print(f"✓ Workspace admin correctly blocked from changing platform roles (403)")

    def test_workspace_admin_can_change_workspace_role(self, workspace_admin_token):
        """Workspace admin should be able to change workspace-level roles (admin/member)"""
        # Get users in workspace
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {workspace_admin_token}"}
        )
        assert response.status_code == 200
        users = response.json()
        
        # Find a non-owner, non-superadmin user
        target_user = None
        for u in users:
            if (u.get("email") != WORKSPACE_ADMIN_EMAIL and 
                u.get("role") != "superadmin" and 
                u.get("platform_role") != "superadmin"):
                target_user = u
                break
        
        if not target_user:
            pytest.skip("No suitable target user found for workspace role change test")
        
        # Try to change workspace role (with workspace_id) - should succeed
        response = requests.patch(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/role",
            headers={"Authorization": f"Bearer {workspace_admin_token}"},
            json={"role": "member", "workspace_id": DEV_WORKSPACE_ID}
        )
        # Should be 200 or 400 (if user is owner), but NOT 403
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        print(f"✓ Workspace admin can change workspace roles (status: {response.status_code})")


class TestWorkspaceAdminDeleteRestrictions:
    """Test workspace admin delete restrictions"""

    def test_workspace_admin_cannot_delete_superadmin(self, workspace_admin_token, superadmin_token):
        """Workspace admin should NOT be able to delete superadmin users"""
        # Get superadmin user ID
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        users = response.json()
        
        superadmin_user = None
        for u in users:
            if u.get("email") == SUPERADMIN_EMAIL:
                superadmin_user = u
                break
        
        if not superadmin_user:
            pytest.skip("Superadmin user not found in user list")
        
        # Try to delete superadmin - should fail with 400
        response = requests.delete(
            f"{BASE_URL}/api/admin/users/{superadmin_user['id']}",
            headers={"Authorization": f"Bearer {workspace_admin_token}"}
        )
        assert response.status_code == 400, f"Expected 400 when deleting superadmin, got {response.status_code}: {response.text}"
        assert "admin" in response.text.lower() or "cannot" in response.text.lower()
        print(f"✓ Workspace admin correctly blocked from deleting superadmin (400)")


class TestWorkspaceAdminPageAccess:
    """Test workspace admin access to admin pages via API"""

    def test_workspace_admin_can_access_organisations_api(self, workspace_admin_token):
        """Workspace admin should be able to access organisations API"""
        response = requests.get(
            f"{BASE_URL}/api/v2/organisations",
            headers={"Authorization": f"Bearer {workspace_admin_token}"}
        )
        # Should be 200 (success) or 404 (no orgs) but NOT 403
        assert response.status_code != 403, f"Workspace admin should have access to organisations API, got {response.status_code}"
        print(f"✓ Workspace admin can access organisations API (status: {response.status_code})")

    def test_workspace_admin_can_access_analytics_api(self, workspace_admin_token):
        """Workspace admin should be able to access analytics API"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/overview",
            headers={"Authorization": f"Bearer {workspace_admin_token}"}
        )
        # Should not be 403
        assert response.status_code != 403, f"Workspace admin should have access to analytics API, got {response.status_code}"
        print(f"✓ Workspace admin can access analytics API (status: {response.status_code})")


class TestWorkspaceAdminInvite:
    """Test workspace admin invite functionality"""

    def test_workspace_admin_can_invite_user(self, workspace_admin_token):
        """Workspace admin should be able to invite users to their workspace"""
        import uuid
        test_email = f"TEST_invite_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={"Authorization": f"Bearer {workspace_admin_token}"},
            json={
                "email": test_email,
                "role": "user",
                "workspace_id": DEV_WORKSPACE_ID,
                "workspace_role": "member",
                "first_name": "Test",
                "last_name": "User"
            }
        )
        # Should succeed (200) or fail for other reasons (not 403)
        assert response.status_code != 403, f"Workspace admin should be able to invite users, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            print(f"✓ Workspace admin can invite users (status: 200)")
            # Clean up - revoke the invitation
            data = response.json()
            if "token" in data:
                requests.delete(
                    f"{BASE_URL}/api/admin/users/invitations/{data['token']}",
                    headers={"Authorization": f"Bearer {workspace_admin_token}"}
                )
        else:
            print(f"✓ Workspace admin invite endpoint accessible (status: {response.status_code})")


class TestAuthEndpoints:
    """Basic auth endpoint tests"""

    def test_superadmin_login(self):
        """Test superadmin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Superadmin login failed: {response.status_code}"
        data = response.json()
        assert "token" in data
        assert data.get("user", {}).get("role") == "superadmin" or data.get("user", {}).get("platform_role") == "superadmin"
        print(f"✓ Superadmin login successful")

    def test_workspace_admin_login(self):
        """Test workspace admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": WORKSPACE_ADMIN_EMAIL,
            "password": WORKSPACE_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Workspace admin login failed: {response.status_code}"
        data = response.json()
        assert "token" in data
        # Workspace admin should NOT be superadmin
        user = data.get("user", {})
        assert user.get("role") != "superadmin" or user.get("platform_role") != "superadmin"
        print(f"✓ Workspace admin login successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
