"""
Iteration 81 - Invite Workspace Display & Workspace Deletion Tests

Tests:
1. GET /api/invite/{token} returns workspace_name and workspace_role when invite has workspace_id
2. POST /api/invite/{token}/accept creates user AND adds to workspace_members
3. DELETE /api/v2/workspaces/{ws_id} cascade protection (refuses if org_count > 0)
4. DELETE /api/v2/workspaces/{ws_id} succeeds for empty workspace
"""

import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "admin@bitbotpro.io"
SUPERADMIN_PASSWORD = "Admin@123"
WORKSPACE_OWNER_EMAIL = "admin@bridgebot.tech"
WORKSPACE_OWNER_PASSWORD = "Admin@123"
DEV_WORKSPACE_ID = "5346b610-1c2c-4bfe-86a5-de820e315ddf"


class TestInviteWorkspaceDisplay:
    """Test invite endpoint returns workspace info when workspace_id is assigned"""
    
    @pytest.fixture(scope="class")
    def superadmin_session(self):
        """Login as superadmin and return session with auth headers"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Superadmin login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    @pytest.fixture(scope="class")
    def test_invite_tokens(self):
        """Track created invite tokens for cleanup"""
        return []
    
    @pytest.fixture(scope="class", autouse=True)
    def cleanup_invites(self, superadmin_session, test_invite_tokens):
        """Cleanup test invitations after tests"""
        yield
        for token in test_invite_tokens:
            try:
                superadmin_session.post(f"{BASE_URL}/api/admin/users/invitations/{token}/revoke")
            except Exception:
                pass
    
    def test_create_invite_with_workspace_and_verify_details(self, superadmin_session, test_invite_tokens):
        """
        Create an invite with workspace_id via POST /api/admin/users/invite
        Then verify GET /api/invite/{token} returns workspace_name and workspace_role
        """
        # Create unique test email
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"TEST_invite_ws_{unique_id}@test.com"
        
        # Create invite with workspace assignment
        invite_resp = superadmin_session.post(f"{BASE_URL}/api/admin/users/invite", json={
            "email": test_email,
            "role": "user",
            "workspace_id": DEV_WORKSPACE_ID,
            "workspace_role": "member",
            "first_name": "Test",
            "last_name": "User"
        })
        
        assert invite_resp.status_code == 200, f"Failed to create invite: {invite_resp.text}"
        invite_data = invite_resp.json()
        assert "token" in invite_data, "Invite response should contain token"
        
        token = invite_data["token"]
        test_invite_tokens.append(token)
        print(f"✓ Created invite with token: {token[:20]}...")
        
        # Now GET the invite details (public endpoint - no auth needed)
        details_resp = requests.get(f"{BASE_URL}/api/invite/{token}")
        assert details_resp.status_code == 200, f"Failed to get invite details: {details_resp.text}"
        
        details = details_resp.json()
        print(f"Invite details: {details}")
        
        # Verify workspace_name is returned
        assert "workspace_name" in details, "Response should include workspace_name"
        assert details["workspace_name"] is not None, "workspace_name should not be None"
        assert details["workspace_name"] == "development", f"Expected 'development', got '{details['workspace_name']}'"
        
        # Verify workspace_role is returned
        assert "workspace_role" in details, "Response should include workspace_role"
        assert details["workspace_role"] == "member", f"Expected 'member', got '{details['workspace_role']}'"
        
        # Verify other fields (email is lowercased by backend)
        assert details["email"] == test_email.lower()
        assert details["first_name"] == "Test"
        assert details["last_name"] == "User"
        
        print(f"✓ GET /api/invite/{token[:20]}... returns workspace_name='{details['workspace_name']}' and workspace_role='{details['workspace_role']}'")
    
    def test_invite_without_workspace_returns_null_workspace_fields(self, superadmin_session, test_invite_tokens):
        """
        Create an invite WITHOUT workspace_id
        Verify GET /api/invite/{token} returns null for workspace fields
        """
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"TEST_invite_no_ws_{unique_id}@test.com"
        
        # Create invite WITHOUT workspace
        invite_resp = superadmin_session.post(f"{BASE_URL}/api/admin/users/invite", json={
            "email": test_email,
            "role": "user"
        })
        
        assert invite_resp.status_code == 200, f"Failed to create invite: {invite_resp.text}"
        token = invite_resp.json()["token"]
        test_invite_tokens.append(token)
        
        # GET invite details
        details_resp = requests.get(f"{BASE_URL}/api/invite/{token}")
        assert details_resp.status_code == 200
        
        details = details_resp.json()
        
        # workspace_name should be None when no workspace assigned
        assert details.get("workspace_name") is None, f"workspace_name should be None, got {details.get('workspace_name')}"
        assert details.get("workspace_role") is None, f"workspace_role should be None when no workspace, got {details.get('workspace_role')}"
        
        print(f"✓ Invite without workspace correctly returns null workspace fields")


class TestInviteAcceptWorkspaceMembership:
    """Test that accepting an invite with workspace_id adds user to workspace_members"""
    
    @pytest.fixture(scope="class")
    def superadmin_session(self):
        """Login as superadmin"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    @pytest.fixture(scope="class")
    def created_user_ids(self):
        """Track created users for cleanup"""
        return []
    
    @pytest.fixture(scope="class", autouse=True)
    def cleanup_users(self, superadmin_session, created_user_ids):
        """Cleanup test users after tests"""
        yield
        for user_id in created_user_ids:
            try:
                # Remove from workspace members
                superadmin_session.delete(f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/members/{user_id}")
                # Delete user
                superadmin_session.delete(f"{BASE_URL}/api/admin/users/{user_id}")
            except Exception:
                pass
    
    def test_accept_invite_adds_to_workspace_members(self, superadmin_session, created_user_ids):
        """
        1. Create invite with workspace_id
        2. Accept the invite
        3. Verify user is added to workspace_members with correct role
        """
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"TEST_accept_ws_{unique_id}@test.com"
        test_username = f"test_accept_{unique_id}"
        
        # Step 1: Create invite with workspace
        invite_resp = superadmin_session.post(f"{BASE_URL}/api/admin/users/invite", json={
            "email": test_email,
            "role": "user",
            "workspace_id": DEV_WORKSPACE_ID,
            "workspace_role": "admin"  # Test with admin role
        })
        assert invite_resp.status_code == 200, f"Failed to create invite: {invite_resp.text}"
        token = invite_resp.json()["token"]
        print(f"✓ Created invite for {test_email} with workspace_role=admin")
        
        # Step 2: Accept the invite (public endpoint)
        accept_resp = requests.post(f"{BASE_URL}/api/invite/{token}/accept", json={
            "username": test_username,
            "password": "TestPass123!",
            "first_name": "Test",
            "last_name": "Accept"
        })
        assert accept_resp.status_code == 200, f"Failed to accept invite: {accept_resp.text}"
        print(f"✓ Accepted invite, account created for {test_email}")
        
        # Step 3: Verify user was added to workspace_members
        # First, get the user ID from workspace users endpoint
        ws_users_resp = superadmin_session.get(f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/users")
        assert ws_users_resp.status_code == 200
        
        users = ws_users_resp.json().get("users", [])
        test_user = next((u for u in users if u.get("email") == test_email.lower()), None)
        assert test_user is not None, f"User {test_email} not found in users list"
        
        user_id = test_user["id"]
        created_user_ids.append(user_id)
        print(f"✓ Found created user with ID: {user_id}")
        
        # Check workspace members
        members_resp = superadmin_session.get(f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/members")
        assert members_resp.status_code == 200, f"Failed to get workspace members: {members_resp.text}"
        
        members = members_resp.json().get("members", [])
        user_membership = next((m for m in members if m.get("user_id") == user_id), None)
        
        assert user_membership is not None, f"User {user_id} not found in workspace members"
        assert user_membership["role"] == "admin", f"Expected role 'admin', got '{user_membership['role']}'"
        
        print(f"✓ User correctly added to workspace_members with role='admin'")


class TestWorkspaceDeletionCascadeProtection:
    """Test workspace deletion cascade protection"""
    
    @pytest.fixture(scope="class")
    def superadmin_session(self):
        """Login as superadmin"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_cannot_delete_workspace_with_organisations(self, superadmin_session):
        """
        Attempting to delete a workspace that has organisations should return an error
        """
        # Try to delete the development workspace (which has orgs)
        delete_resp = superadmin_session.delete(f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}")
        
        # Should fail with 400
        assert delete_resp.status_code == 400, f"Expected 400, got {delete_resp.status_code}: {delete_resp.text}"
        
        error_detail = delete_resp.json().get("detail", "")
        assert "Cannot delete workspace" in error_detail, f"Expected cascade protection error, got: {error_detail}"
        assert "organisation" in error_detail.lower(), f"Error should mention organisations: {error_detail}"
        
        print(f"✓ Cascade protection working: {error_detail}")


class TestWorkspaceDeletionSuccess:
    """Test successful workspace deletion for empty workspace"""
    
    @pytest.fixture(scope="class")
    def superadmin_session(self):
        """Login as superadmin"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_create_and_delete_empty_workspace(self, superadmin_session):
        """
        1. Create a new test workspace
        2. Verify it appears in workspace list
        3. Delete it via API
        4. Verify it's removed from workspace list
        """
        unique_id = str(uuid.uuid4())[:8]
        ws_name = f"TEST_Delete_WS_{unique_id}"
        
        # Step 1: Create workspace
        create_resp = superadmin_session.post(f"{BASE_URL}/api/v2/workspaces", json={
            "name": ws_name
        })
        assert create_resp.status_code == 200, f"Failed to create workspace: {create_resp.text}"
        
        ws_data = create_resp.json()
        ws_id = ws_data["id"]
        print(f"✓ Created test workspace: {ws_name} (ID: {ws_id})")
        
        # Step 2: Verify it appears in list
        list_resp = superadmin_session.get(f"{BASE_URL}/api/v2/workspaces")
        assert list_resp.status_code == 200
        
        workspaces = list_resp.json().get("workspaces", [])
        found = any(w["id"] == ws_id for w in workspaces)
        assert found, f"Workspace {ws_id} not found in list"
        print(f"✓ Workspace appears in list")
        
        # Step 3: Delete the workspace
        delete_resp = superadmin_session.delete(f"{BASE_URL}/api/v2/workspaces/{ws_id}")
        assert delete_resp.status_code == 200, f"Failed to delete workspace: {delete_resp.text}"
        print(f"✓ Workspace deleted successfully")
        
        # Step 4: Verify it's removed
        list_resp2 = superadmin_session.get(f"{BASE_URL}/api/v2/workspaces")
        assert list_resp2.status_code == 200
        
        workspaces2 = list_resp2.json().get("workspaces", [])
        found2 = any(w["id"] == ws_id for w in workspaces2)
        assert not found2, f"Workspace {ws_id} should not be in list after deletion"
        print(f"✓ Workspace removed from list after deletion")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
