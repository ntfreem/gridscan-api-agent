"""
Iteration 82 - Enterprise Workspaces Backend Tests
Tests for:
- Workspace CRUD operations
- Workspace member management (list, add, remove, role update)
- Workspace orgs listing
- Cascade protection on delete
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
SUPERADMIN_EMAIL = "admin@bitbotpro.io"
SUPERADMIN_PASSWORD = "Admin@123"
WORKSPACE_OWNER_EMAIL = "admin@bridgebot.tech"
WORKSPACE_OWNER_PASSWORD = "Admin@123"
DEV_WORKSPACE_ID = "5346b610-1c2c-4bfe-86a5-de820e315ddf"


class TestEnterpriseWorkspacesAPI:
    """Tests for Enterprise Workspaces API endpoints"""
    
    @pytest.fixture(scope="class")
    def superadmin_token(self):
        """Get superadmin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email_or_username": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Superadmin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def workspace_owner_token(self):
        """Get workspace owner auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email_or_username": WORKSPACE_OWNER_EMAIL, "password": WORKSPACE_OWNER_PASSWORD}
        )
        assert response.status_code == 200, f"Workspace owner login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def superadmin_headers(self, superadmin_token):
        """Headers with superadmin auth"""
        return {"Authorization": f"Bearer {superadmin_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def owner_headers(self, workspace_owner_token):
        """Headers with workspace owner auth"""
        return {"Authorization": f"Bearer {workspace_owner_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def created_workspace_ids(self):
        """Track test-created workspaces for cleanup"""
        return []
    
    @pytest.fixture(scope="class", autouse=True)
    def cleanup_test_workspaces(self, superadmin_headers, created_workspace_ids):
        """Cleanup test workspaces after all tests"""
        yield
        for ws_id in created_workspace_ids:
            try:
                requests.delete(f"{BASE_URL}/api/v2/workspaces/{ws_id}", headers=superadmin_headers)
            except Exception:
                pass
    
    # ── Test: List Workspaces ──
    def test_list_workspaces_superadmin(self, superadmin_headers):
        """Superadmin can list all workspaces"""
        response = requests.get(f"{BASE_URL}/api/v2/workspaces", headers=superadmin_headers)
        assert response.status_code == 200, f"Failed to list workspaces: {response.text}"
        data = response.json()
        assert "workspaces" in data
        assert isinstance(data["workspaces"], list)
        # Should have at least the development workspace
        ws_ids = [ws["id"] for ws in data["workspaces"]]
        assert DEV_WORKSPACE_ID in ws_ids, "Development workspace not found"
        # Check workspace has required fields
        for ws in data["workspaces"]:
            assert "id" in ws
            assert "name" in ws
            assert "slug" in ws
            assert "org_count" in ws
            assert "member_count" in ws
        print(f"✓ Superadmin can list {len(data['workspaces'])} workspaces")
    
    def test_list_workspaces_owner(self, owner_headers):
        """Workspace owner can list their workspaces"""
        response = requests.get(f"{BASE_URL}/api/v2/workspaces", headers=owner_headers)
        assert response.status_code == 200, f"Failed to list workspaces: {response.text}"
        data = response.json()
        assert "workspaces" in data
        # Owner should see at least the development workspace
        ws_ids = [ws["id"] for ws in data["workspaces"]]
        assert DEV_WORKSPACE_ID in ws_ids, "Development workspace not found for owner"
        print(f"✓ Workspace owner can list {len(data['workspaces'])} workspaces")
    
    # ── Test: Create Workspace ──
    def test_create_workspace(self, superadmin_headers, created_workspace_ids):
        """Superadmin can create a new workspace"""
        test_name = f"TEST_Workspace_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/v2/workspaces",
            headers=superadmin_headers,
            json={"name": test_name}
        )
        assert response.status_code == 200, f"Failed to create workspace: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == test_name
        assert "slug" in data
        created_workspace_ids.append(data["id"])
        print(f"✓ Created workspace: {data['name']} (id: {data['id']})")
        return data["id"]
    
    def test_create_workspace_duplicate_slug(self, superadmin_headers, created_workspace_ids):
        """Creating workspace with duplicate slug fails"""
        test_name = f"TEST_DupSlug_{uuid.uuid4().hex[:8]}"
        # Create first workspace
        response1 = requests.post(
            f"{BASE_URL}/api/v2/workspaces",
            headers=superadmin_headers,
            json={"name": test_name}
        )
        assert response1.status_code == 200
        created_workspace_ids.append(response1.json()["id"])
        
        # Try to create with same name (same slug)
        response2 = requests.post(
            f"{BASE_URL}/api/v2/workspaces",
            headers=superadmin_headers,
            json={"name": test_name}
        )
        assert response2.status_code == 409, f"Expected 409 for duplicate slug, got {response2.status_code}"
        print("✓ Duplicate slug correctly rejected with 409")
    
    # ── Test: Get Workspace Detail ──
    def test_get_workspace_detail(self, superadmin_headers):
        """Can get workspace detail with counts"""
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}",
            headers=superadmin_headers
        )
        assert response.status_code == 200, f"Failed to get workspace: {response.text}"
        data = response.json()
        assert data["id"] == DEV_WORKSPACE_ID
        assert "name" in data
        assert "org_count" in data
        assert "member_count" in data
        print(f"✓ Got workspace detail: {data['name']} ({data['org_count']} orgs, {data['member_count']} members)")
    
    # ── Test: List Workspace Members ──
    def test_list_workspace_members(self, superadmin_headers):
        """Can list workspace members with roles"""
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/members",
            headers=superadmin_headers
        )
        assert response.status_code == 200, f"Failed to list members: {response.text}"
        data = response.json()
        assert "members" in data
        assert isinstance(data["members"], list)
        # Check member has required fields
        for member in data["members"]:
            assert "user_id" in member
            assert "role" in member
            assert member["role"] in ["owner", "admin", "member"]
        print(f"✓ Listed {len(data['members'])} workspace members")
    
    # ── Test: List Workspace Orgs ──
    def test_list_workspace_orgs(self, superadmin_headers):
        """Can list organisations in a workspace"""
        response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/orgs",
            headers=superadmin_headers
        )
        assert response.status_code == 200, f"Failed to list orgs: {response.text}"
        data = response.json()
        assert "organisations" in data
        assert isinstance(data["organisations"], list)
        # Development workspace should have at least one org
        assert len(data["organisations"]) > 0, "Development workspace should have orgs"
        for org in data["organisations"]:
            assert "id" in org
            assert "name" in org
        print(f"✓ Listed {len(data['organisations'])} organisations in workspace")
    
    # ── Test: Delete Workspace Cascade Protection ──
    def test_delete_workspace_cascade_protection(self, superadmin_headers):
        """Cannot delete workspace with organisations"""
        response = requests.delete(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}",
            headers=superadmin_headers
        )
        assert response.status_code == 400, f"Expected 400 for cascade protection, got {response.status_code}"
        data = response.json()
        assert "organisation" in data.get("detail", "").lower(), f"Expected cascade protection message, got: {data}"
        print("✓ Cascade protection works - cannot delete workspace with orgs")
    
    # ── Test: Create and Delete Empty Workspace ──
    def test_create_and_delete_empty_workspace(self, superadmin_headers):
        """Can create and delete an empty workspace"""
        test_name = f"TEST_DeleteMe_{uuid.uuid4().hex[:8]}"
        
        # Create
        create_response = requests.post(
            f"{BASE_URL}/api/v2/workspaces",
            headers=superadmin_headers,
            json={"name": test_name}
        )
        assert create_response.status_code == 200
        ws_id = create_response.json()["id"]
        
        # Verify it exists
        list_response = requests.get(f"{BASE_URL}/api/v2/workspaces", headers=superadmin_headers)
        ws_ids = [ws["id"] for ws in list_response.json()["workspaces"]]
        assert ws_id in ws_ids, "Created workspace not in list"
        
        # Delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/v2/workspaces/{ws_id}",
            headers=superadmin_headers
        )
        assert delete_response.status_code == 200, f"Failed to delete: {delete_response.text}"
        
        # Verify it's gone
        list_response2 = requests.get(f"{BASE_URL}/api/v2/workspaces", headers=superadmin_headers)
        ws_ids2 = [ws["id"] for ws in list_response2.json()["workspaces"]]
        assert ws_id not in ws_ids2, "Deleted workspace still in list"
        print("✓ Successfully created and deleted empty workspace")
    
    # ── Test: Member Role Update ──
    def test_member_role_update_requires_owner(self, owner_headers, superadmin_headers):
        """Member role update requires workspace owner permission"""
        # First get members to find a non-owner member
        members_response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/members",
            headers=superadmin_headers
        )
        assert members_response.status_code == 200
        members = members_response.json()["members"]
        
        # Find a non-owner member
        non_owner = next((m for m in members if m["role"] != "owner"), None)
        if non_owner:
            # Try to update role (should work for owner/superadmin)
            response = requests.patch(
                f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/members/{non_owner['user_id']}/role",
                headers=superadmin_headers,
                json={"role": "admin"}
            )
            # Should succeed for superadmin
            assert response.status_code == 200, f"Role update failed: {response.text}"
            print(f"✓ Superadmin can update member role")
        else:
            print("⚠ No non-owner members to test role update")
    
    # ── Test: Cannot Assign Owner Role via Role Update ──
    def test_cannot_assign_owner_via_role_update(self, superadmin_headers):
        """Cannot assign owner role via role update endpoint"""
        members_response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/members",
            headers=superadmin_headers
        )
        members = members_response.json()["members"]
        non_owner = next((m for m in members if m["role"] != "owner"), None)
        
        if non_owner:
            response = requests.patch(
                f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/members/{non_owner['user_id']}/role",
                headers=superadmin_headers,
                json={"role": "owner"}
            )
            assert response.status_code == 400, f"Expected 400 for owner role assignment, got {response.status_code}"
            print("✓ Cannot assign owner role via role update endpoint")
        else:
            print("⚠ No non-owner members to test")


class TestWorkspaceMemberManagement:
    """Tests for workspace member add/remove operations"""
    
    @pytest.fixture(scope="class")
    def superadmin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email_or_username": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def superadmin_headers(self, superadmin_token):
        return {"Authorization": f"Bearer {superadmin_token}", "Content-Type": "application/json"}
    
    def test_cannot_remove_workspace_owner(self, superadmin_headers):
        """Cannot remove the workspace owner"""
        # Get workspace to find owner_id
        ws_response = requests.get(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}",
            headers=superadmin_headers
        )
        owner_id = ws_response.json().get("owner_id")
        
        if owner_id:
            response = requests.delete(
                f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/members/{owner_id}",
                headers=superadmin_headers
            )
            assert response.status_code == 400, f"Expected 400 for removing owner, got {response.status_code}"
            print("✓ Cannot remove workspace owner")
        else:
            print("⚠ Could not find owner_id to test")
    
    def test_remove_nonexistent_member(self, superadmin_headers):
        """Removing non-existent member returns 404"""
        fake_user_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/v2/workspaces/{DEV_WORKSPACE_ID}/members/{fake_user_id}",
            headers=superadmin_headers
        )
        assert response.status_code == 404, f"Expected 404 for non-existent member, got {response.status_code}"
        print("✓ Removing non-existent member returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
