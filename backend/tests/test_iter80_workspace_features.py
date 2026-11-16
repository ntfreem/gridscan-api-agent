"""
Iteration 80 - Workspace Features Testing
Tests for:
1. POST /api/v2/workspaces - Create workspace (superadmin only)
2. GET /api/v2/workspaces/{ws_id}/user-orgs/{user_id} - Get user org memberships
3. POST /api/v2/workspaces/{ws_id}/org-membership - Add/remove user from org
4. POST /api/admin/users/invite - Invite user with workspace role
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
SUPERADMIN_EMAIL = "admin@bitbotpro.io"
SUPERADMIN_PASSWORD = "Admin@123"
WORKSPACE_OWNER_EMAIL = "admin@bridgebot.tech"
WORKSPACE_OWNER_PASSWORD = "Admin@123"
DEV_WORKSPACE_ID = "5346b610-1c2c-4bfe-86a5-de820e315ddf"
DEFAULT_ORG_ID = "cb91e73c-b74b-45a3-aecc-f7823ee07d2c"
BRIDGEBOT_USER_ID = "15fdc66c-52cb-4138-8c05-4335ee7bd516"


@pytest.fixture(scope="module")
def superadmin_token():
    """Get superadmin token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Superadmin login failed: {resp.text}"
    return resp.json()["token"]


@pytest.fixture(scope="module")
def workspace_owner_token():
    """Get workspace owner token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": WORKSPACE_OWNER_EMAIL,
        "password": WORKSPACE_OWNER_PASSWORD
    })
    assert resp.status_code == 200, f"Workspace owner login failed: {resp.text}"
    return resp.json()["token"]


@pytest.fixture(scope="module")
def created_workspace_ids():
    """Track created workspaces for cleanup"""
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_workspaces(superadmin_token, created_workspace_ids):
    """Cleanup test workspaces after all tests"""
    yield
    for ws_id in created_workspace_ids:
        try:
            # First delete any orgs in the workspace
            resp = requests.get(
                f"{BASE_URL}/api/v2/workspaces/{ws_id}/orgs",
                headers={"Authorization": f"Bearer {superadmin_token}"}
            )
            if resp.status_code == 200:
                orgs = resp.json().get("organisations", [])
                for org in orgs:
                    requests.delete(
                        f"{BASE_URL}/api/v2/orgs/{org['id']}",
                        headers={"Authorization": f"Bearer {superadmin_token}"}
                    )
            # Then delete the workspace
            requests.delete(
                f"{BASE_URL}/api/v2/workspaces/{ws_id}",
                headers={"Authorization": f"Bearer {superadmin_token}"}
            )
        except Exception as e:
            print(f"Cleanup error for workspace {ws_id}: {e}")


class TestWorkspaceCreation:
    """Test POST /api/v2/workspaces - Create workspace"""
    
    def test_create_workspace_superadmin(self, superadmin_token, created_workspace_ids):
        """Superadmin can create a new workspace"""
        unique_name = f"TEST_Workspace_{uuid.uuid4().hex[:8]}"
        resp = requests.post(
            f"{BASE_URL}/api/v2/workspaces",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"name": unique_name}
        )
        assert resp.status_code == 200, f"Create workspace failed: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "id" in data, "Response should contain workspace id"
        assert data["name"] == unique_name, "Workspace name should match"
        assert "slug" in data, "Response should contain slug"
        # Slug is lowercase with spaces replaced by dashes (underscores preserved)
        assert data["slug"] == unique_name.lower().replace(" ", "-"), "Slug should be lowercase"
        
        created_workspace_ids.append(data["id"])
        print(f"SUCCESS: Created workspace {unique_name} with id {data['id']}")
    
    def test_create_workspace_duplicate_slug_rejected(self, superadmin_token, created_workspace_ids):
        """Creating workspace with duplicate slug should fail"""
        unique_name = f"TEST_Duplicate_{uuid.uuid4().hex[:8]}"
        
        # Create first workspace
        resp1 = requests.post(
            f"{BASE_URL}/api/v2/workspaces",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"name": unique_name}
        )
        assert resp1.status_code == 200, f"First create failed: {resp1.text}"
        created_workspace_ids.append(resp1.json()["id"])
        
        # Try to create duplicate
        resp2 = requests.post(
            f"{BASE_URL}/api/v2/workspaces",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"name": unique_name}
        )
        assert resp2.status_code == 409, f"Duplicate should return 409, got {resp2.status_code}: {resp2.text}"
        print("SUCCESS: Duplicate workspace slug correctly rejected with 409")
    
    def test_create_workspace_with_custom_slug(self, superadmin_token, created_workspace_ids):
        """Create workspace with custom slug"""
        unique_name = f"TEST_Custom_{uuid.uuid4().hex[:8]}"
        custom_slug = f"custom-slug-{uuid.uuid4().hex[:8]}"
        
        resp = requests.post(
            f"{BASE_URL}/api/v2/workspaces",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"name": unique_name, "slug": custom_slug}
        )
        assert resp.status_code == 200, f"Create with custom slug failed: {resp.text}"
        data = resp.json()
        assert data["slug"] == custom_slug.lower(), "Custom slug should be used"
        created_workspace_ids.append(data["id"])
        print(f"SUCCESS: Created workspace with custom slug {custom_slug}")


class TestUserOrgMemberships:
    """Test GET /api/v2/workspaces/{ws_id}/user-orgs/{user_id}"""
    
    def test_get_user_org_memberships(self, superadmin_token):
        """Get org memberships for a user within a workspace"""
        resp = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/user-orgs/{BRIDGEBOT_USER_ID}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert resp.status_code == 200, f"Get user org memberships failed: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "org_memberships" in data, "Response should contain org_memberships"
        memberships = data["org_memberships"]
        assert isinstance(memberships, list), "org_memberships should be a list"
        
        # Check structure of each membership
        if memberships:
            m = memberships[0]
            assert "org_id" in m, "Membership should have org_id"
            assert "org_name" in m, "Membership should have org_name"
            assert "is_member" in m, "Membership should have is_member"
            assert "is_owner" in m, "Membership should have is_owner"
            print(f"SUCCESS: Got {len(memberships)} org memberships for user")
        else:
            print("SUCCESS: User has no org memberships (empty list)")
    
    def test_get_user_org_memberships_nonexistent_user(self, superadmin_token):
        """Get org memberships for non-existent user returns empty list"""
        fake_user_id = str(uuid.uuid4())
        resp = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/user-orgs/{fake_user_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        # Should return 200 with empty list, not 404
        assert resp.status_code == 200, f"Should return 200 for non-existent user: {resp.text}"
        data = resp.json()
        assert "org_memberships" in data
        print("SUCCESS: Non-existent user returns empty org memberships")


class TestOrgMembershipUpdate:
    """Test POST /api/v2/workspaces/{ws_id}/org-membership"""
    
    def test_add_user_to_org(self, superadmin_token):
        """Add a user to an org within a workspace"""
        # First check current membership
        resp = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/user-orgs/{BRIDGEBOT_USER_ID}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert resp.status_code == 200
        memberships = resp.json().get("org_memberships", [])
        
        # Find an org where user is not a member
        target_org = None
        for m in memberships:
            if not m["is_member"] and not m["is_owner"]:
                target_org = m
                break
        
        if not target_org:
            # User is already member of all orgs, skip test
            print("SKIP: User is already member of all orgs in workspace")
            return
        
        # Add user to org
        resp = requests.post(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/org-membership",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "user_id": BRIDGEBOT_USER_ID,
                "org_id": target_org["org_id"],
                "action": "add",
                "org_role": "member"
            }
        )
        assert resp.status_code == 200, f"Add to org failed: {resp.text}"
        
        # Verify membership was added
        resp = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/user-orgs/{BRIDGEBOT_USER_ID}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        memberships = resp.json().get("org_memberships", [])
        updated = next((m for m in memberships if m["org_id"] == target_org["org_id"]), None)
        assert updated and updated["is_member"], "User should now be a member"
        print(f"SUCCESS: Added user to org {target_org['org_name']}")
        
        # Clean up - remove user from org
        requests.post(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/org-membership",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "user_id": BRIDGEBOT_USER_ID,
                "org_id": target_org["org_id"],
                "action": "remove"
            }
        )
    
    def test_remove_user_from_org(self, superadmin_token):
        """Remove a user from an org"""
        # First check current membership
        resp = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/user-orgs/{BRIDGEBOT_USER_ID}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert resp.status_code == 200
        memberships = resp.json().get("org_memberships", [])
        
        # Find an org where user is a member but not owner
        target_org = None
        for m in memberships:
            if m["is_member"] and not m["is_owner"]:
                target_org = m
                break
        
        if not target_org:
            print("SKIP: No org found where user is member but not owner")
            return
        
        # Remove user from org
        resp = requests.post(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/org-membership",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "user_id": BRIDGEBOT_USER_ID,
                "org_id": target_org["org_id"],
                "action": "remove"
            }
        )
        assert resp.status_code == 200, f"Remove from org failed: {resp.text}"
        
        # Verify membership was removed
        resp = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/user-orgs/{BRIDGEBOT_USER_ID}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        memberships = resp.json().get("org_memberships", [])
        updated = next((m for m in memberships if m["org_id"] == target_org["org_id"]), None)
        assert updated and not updated["is_member"], "User should no longer be a member"
        print(f"SUCCESS: Removed user from org {target_org['org_name']}")
        
        # Clean up - add user back
        requests.post(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/org-membership",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "user_id": BRIDGEBOT_USER_ID,
                "org_id": target_org["org_id"],
                "action": "add",
                "org_role": "member"
            }
        )
    
    def test_cannot_remove_org_owner(self, superadmin_token):
        """Cannot remove the org owner from their org"""
        # Get org memberships to find an org where user is owner
        resp = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/user-orgs/{BRIDGEBOT_USER_ID}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        memberships = resp.json().get("org_memberships", [])
        
        owner_org = None
        for m in memberships:
            if m["is_owner"]:
                owner_org = m
                break
        
        if not owner_org:
            print("SKIP: User is not owner of any org")
            return
        
        # Try to remove owner
        resp = requests.post(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/org-membership",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "user_id": BRIDGEBOT_USER_ID,
                "org_id": owner_org["org_id"],
                "action": "remove"
            }
        )
        assert resp.status_code == 400, f"Should reject removing org owner: {resp.text}"
        print("SUCCESS: Cannot remove org owner - correctly rejected with 400")


class TestUserInvitation:
    """Test POST /api/admin/users/invite with workspace role"""
    
    def test_invite_user_with_workspace(self, superadmin_token):
        """Invite a user with workspace assignment"""
        unique_email = f"TEST_invite_{uuid.uuid4().hex[:8]}@example.com"
        
        resp = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "email": unique_email,
                "first_name": "Test",
                "last_name": "User",
                "workspace_id": DEV_WORKSPACE_ID,
                "workspace_role": "member"
            }
        )
        assert resp.status_code == 200, f"Invite failed: {resp.text}"
        data = resp.json()
        assert data.get("success") == True, "Invite should succeed"
        assert "token" in data, "Response should contain invite token"
        print(f"SUCCESS: Invited {unique_email} with workspace role 'member'")
        
        # Clean up - delete the invitation
        # Note: We don't have a delete invitation endpoint, so we leave it
    
    def test_invite_user_with_admin_role(self, superadmin_token):
        """Invite a user as workspace admin"""
        unique_email = f"TEST_admin_{uuid.uuid4().hex[:8]}@example.com"
        
        resp = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "email": unique_email,
                "first_name": "Admin",
                "last_name": "User",
                "workspace_id": DEV_WORKSPACE_ID,
                "workspace_role": "admin"
            }
        )
        assert resp.status_code == 200, f"Invite admin failed: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        print(f"SUCCESS: Invited {unique_email} with workspace role 'admin'")
    
    def test_invite_user_without_workspace(self, superadmin_token):
        """Invite a user without workspace assignment (creates their own)"""
        unique_email = f"TEST_nows_{uuid.uuid4().hex[:8]}@example.com"
        
        resp = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "email": unique_email,
                "first_name": "NoWs",
                "last_name": "User"
            }
        )
        assert resp.status_code == 200, f"Invite without workspace failed: {resp.text}"
        print(f"SUCCESS: Invited {unique_email} without workspace assignment")
    
    def test_invite_duplicate_email_rejected(self, superadmin_token):
        """Cannot invite already registered email"""
        resp = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "email": SUPERADMIN_EMAIL,  # Already registered
                "first_name": "Duplicate",
                "last_name": "User"
            }
        )
        assert resp.status_code == 400, f"Should reject duplicate email: {resp.text}"
        print("SUCCESS: Duplicate email correctly rejected")


class TestWorkspaceListWithCounts:
    """Test GET /api/v2/workspaces returns enriched data"""
    
    def test_workspace_list_has_counts(self, superadmin_token):
        """Workspace list should include org_count and member_count"""
        resp = requests.get(
            f"{BASE_URL}/api/v2/workspaces",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert resp.status_code == 200, f"List workspaces failed: {resp.text}"
        data = resp.json()
        
        assert "workspaces" in data, "Response should contain workspaces"
        workspaces = data["workspaces"]
        assert len(workspaces) > 0, "Should have at least one workspace"
        
        # Check development workspace has counts
        dev_ws = next((ws for ws in workspaces if ws["id"] == DEV_WORKSPACE_ID), None)
        assert dev_ws is not None, "Development workspace should exist"
        assert "org_count" in dev_ws, "Workspace should have org_count"
        assert "member_count" in dev_ws, "Workspace should have member_count"
        assert dev_ws["org_count"] >= 1, "Development workspace should have at least 1 org"
        assert dev_ws["member_count"] >= 1, "Development workspace should have at least 1 member"
        print(f"SUCCESS: Development workspace has {dev_ws['org_count']} orgs, {dev_ws['member_count']} members")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
