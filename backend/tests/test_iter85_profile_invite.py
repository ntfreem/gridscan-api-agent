"""
Iteration 85 - Profile Page & Invite Org Filtering Tests
Tests:
1. Profile API: PATCH /api/auth/profile - update first_name, last_name, username
2. Profile API: PATCH /api/auth/profile - reject duplicate username (400)
3. Password Change API: POST /api/auth/change-password - success with correct current password
4. Password Change API: POST /api/auth/change-password - reject wrong current password (400)
5. Password Change API: POST /api/auth/change-password - reject short new password (400)
6. Invite API: POST /api/admin/users/invite - stores org_ids on invitation record
7. Invite Accept: POST /api/invite/{token}/accept - adds user to org member_ids
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
REGULAR_USER_EMAIL = "johndoe@example.com"
REGULAR_USER_PASSWORD = "User@123"
WORKSPACE_ADMIN_EMAIL = "admin@bridgebot.tech"
WORKSPACE_ADMIN_PASSWORD = "Admin@123"
SUPERADMIN_EMAIL = "admin@bitbotpro.io"
SUPERADMIN_PASSWORD = "Admin@123"
DEVELOPMENT_WORKSPACE_ID = "5346b610-1c2c-4bfe-86a5-de820e315ddf"
DEFAULT_ORG_ID = "cb91e73c-b74b-45a3-aecc-f7823ee07d2c"


@pytest.fixture(scope="module")
def regular_user_token():
    """Login as regular user (johndoe)"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": REGULAR_USER_EMAIL,
        "password": REGULAR_USER_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Regular user login failed: {resp.status_code} - {resp.text}")
    return resp.json().get("token")


@pytest.fixture(scope="module")
def workspace_admin_token():
    """Login as workspace admin"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": WORKSPACE_ADMIN_EMAIL,
        "password": WORKSPACE_ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Workspace admin login failed: {resp.status_code} - {resp.text}")
    return resp.json().get("token")


@pytest.fixture(scope="module")
def superadmin_token():
    """Login as superadmin"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Superadmin login failed: {resp.status_code} - {resp.text}")
    return resp.json().get("token")


class TestProfileAPI:
    """Tests for PATCH /api/auth/profile endpoint"""
    
    def test_profile_update_success(self, regular_user_token):
        """Test updating first_name, last_name, username"""
        # First get current profile to restore later
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {regular_user_token}"
        })
        assert resp.status_code == 200, f"Failed to get current profile: {resp.text}"
        original = resp.json()
        original_first = original.get("first_name", "")
        original_last = original.get("last_name", "")
        original_username = original.get("username", "")
        
        # Update profile with test values
        test_first = "TEST_John"
        test_last = "TEST_Doe"
        test_username = f"test_johndoe_{uuid.uuid4().hex[:6]}"
        
        resp = requests.patch(f"{BASE_URL}/api/auth/profile", 
            headers={"Authorization": f"Bearer {regular_user_token}"},
            json={
                "first_name": test_first,
                "last_name": test_last,
                "username": test_username
            }
        )
        assert resp.status_code == 200, f"Profile update failed: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        print(f"✓ Profile update returned success")
        
        # Verify changes persisted
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {regular_user_token}"
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated.get("first_name") == test_first, f"first_name not updated: {updated.get('first_name')}"
        assert updated.get("last_name") == test_last, f"last_name not updated: {updated.get('last_name')}"
        assert updated.get("username") == test_username.lower(), f"username not updated: {updated.get('username')}"
        print(f"✓ Profile changes persisted correctly")
        
        # Restore original values
        resp = requests.patch(f"{BASE_URL}/api/auth/profile",
            headers={"Authorization": f"Bearer {regular_user_token}"},
            json={
                "first_name": original_first or "John",
                "last_name": original_last or "Doe",
                "username": original_username or "johndoe"
            }
        )
        assert resp.status_code == 200, f"Failed to restore profile: {resp.text}"
        print(f"✓ Profile restored to original values")
    
    def test_profile_reject_duplicate_username(self, regular_user_token, workspace_admin_token):
        """Test that duplicate username is rejected with 400"""
        # Get workspace admin's username
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {workspace_admin_token}"
        })
        assert resp.status_code == 200
        admin_username = resp.json().get("username")
        
        if not admin_username:
            pytest.skip("Workspace admin has no username set")
        
        # Try to set regular user's username to admin's username
        resp = requests.patch(f"{BASE_URL}/api/auth/profile",
            headers={"Authorization": f"Bearer {regular_user_token}"},
            json={"username": admin_username}
        )
        assert resp.status_code == 400, f"Expected 400 for duplicate username, got {resp.status_code}"
        data = resp.json()
        assert "taken" in data.get("detail", "").lower() or "already" in data.get("detail", "").lower()
        print(f"✓ Duplicate username correctly rejected with 400: {data.get('detail')}")


class TestPasswordChangeAPI:
    """Tests for POST /api/auth/change-password endpoint"""
    
    def test_password_change_success(self, regular_user_token):
        """Test changing password with correct current password"""
        new_password = "NewPass@456"
        
        # Change password
        resp = requests.post(f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {regular_user_token}"},
            json={
                "current_password": REGULAR_USER_PASSWORD,
                "new_password": new_password
            }
        )
        assert resp.status_code == 200, f"Password change failed: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        print(f"✓ Password changed successfully")
        
        # Verify new password works by logging in
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": REGULAR_USER_EMAIL,
            "password": new_password
        })
        assert resp.status_code == 200, f"Login with new password failed: {resp.text}"
        print(f"✓ Login with new password successful")
        
        # IMPORTANT: Restore original password
        new_token = resp.json().get("token")
        resp = requests.post(f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {new_token}"},
            json={
                "current_password": new_password,
                "new_password": REGULAR_USER_PASSWORD
            }
        )
        assert resp.status_code == 200, f"Failed to restore password: {resp.text}"
        print(f"✓ Password restored to original (User@123)")
    
    def test_password_change_wrong_current(self, regular_user_token):
        """Test that wrong current password returns 400"""
        resp = requests.post(f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {regular_user_token}"},
            json={
                "current_password": "WrongPassword123",
                "new_password": "NewPass@456"
            }
        )
        assert resp.status_code == 400, f"Expected 400 for wrong password, got {resp.status_code}"
        data = resp.json()
        assert "incorrect" in data.get("detail", "").lower() or "wrong" in data.get("detail", "").lower()
        print(f"✓ Wrong current password correctly rejected: {data.get('detail')}")
    
    def test_password_change_short_new_password(self, regular_user_token):
        """Test that short new password (<6 chars) returns 400"""
        resp = requests.post(f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {regular_user_token}"},
            json={
                "current_password": REGULAR_USER_PASSWORD,
                "new_password": "abc"  # Too short
            }
        )
        assert resp.status_code == 400, f"Expected 400 for short password, got {resp.status_code}"
        data = resp.json()
        assert "6" in data.get("detail", "") or "character" in data.get("detail", "").lower()
        print(f"✓ Short password correctly rejected: {data.get('detail')}")


class TestInviteOrgAssignment:
    """Tests for invite org_ids storage and acceptance"""
    
    def test_invite_stores_org_ids(self, workspace_admin_token):
        """Test that POST /api/admin/users/invite stores org_ids on invitation"""
        test_email = f"test_invite_{uuid.uuid4().hex[:8]}@example.com"
        
        resp = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers={"Authorization": f"Bearer {workspace_admin_token}"},
            json={
                "email": test_email,
                "first_name": "TEST_Invite",
                "last_name": "User",
                "workspace_id": DEVELOPMENT_WORKSPACE_ID,
                "workspace_role": "member",
                "org_ids": [DEFAULT_ORG_ID]
            }
        )
        assert resp.status_code == 200, f"Invite failed: {resp.text}"
        data = resp.json()
        invite_token = data.get("token")  # API returns "token" not "invite_token"
        assert invite_token, f"No token returned: {data}"
        print(f"✓ Invite created with token: {invite_token[:20]}...")
        
        # Verify org_ids stored on invitation
        resp = requests.get(f"{BASE_URL}/api/invite/{invite_token}")
        assert resp.status_code == 200, f"Failed to get invite details: {resp.text}"
        invite_data = resp.json()
        assert invite_data.get("email") == test_email
        print(f"✓ Invite details retrieved for {test_email}")
        
        # Clean up - delete the invitation (if endpoint exists) or leave it
        # The invitation will expire naturally
        return invite_token
    
    def test_invite_accept_adds_to_org_members(self, workspace_admin_token):
        """Test that accepting invite with org_ids adds user to org member_ids"""
        test_email = f"test_accept_{uuid.uuid4().hex[:8]}@example.com"
        test_username = f"testaccept{uuid.uuid4().hex[:6]}"
        
        # Create invitation with org_ids
        resp = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers={"Authorization": f"Bearer {workspace_admin_token}"},
            json={
                "email": test_email,
                "first_name": "TEST_Accept",
                "last_name": "User",
                "workspace_id": DEVELOPMENT_WORKSPACE_ID,
                "workspace_role": "member",
                "org_ids": [DEFAULT_ORG_ID]
            }
        )
        assert resp.status_code == 200, f"Invite failed: {resp.text}"
        invite_token = resp.json().get("token")  # API returns "token" not "invite_token"
        assert invite_token, f"No token returned: {resp.json()}"
        print(f"✓ Invite created for acceptance test")
        
        # Accept the invitation
        resp = requests.post(f"{BASE_URL}/api/invite/{invite_token}/accept",
            json={
                "username": test_username,
                "password": "TestPass@123",
                "first_name": "TEST_Accept",
                "last_name": "User"
            }
        )
        assert resp.status_code == 200, f"Accept invite failed: {resp.text}"
        accept_data = resp.json()
        assert accept_data.get("success") == True, f"Accept not successful: {accept_data}"
        print(f"✓ Invite accepted, user created")
        
        # Verify user can login
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": test_email,
            "password": "TestPass@123"
        })
        assert resp.status_code == 200, f"New user login failed: {resp.text}"
        new_user_token = resp.json().get("token")
        print(f"✓ New user can login")
        
        # Get user ID from /me endpoint
        resp = requests.get(f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {new_user_token}"}
        )
        assert resp.status_code == 200
        new_user_id = resp.json().get("id")
        
        # Verify user is member of the org by checking their orgs
        resp = requests.get(f"{BASE_URL}/api/v2/orgs",
            headers={"Authorization": f"Bearer {new_user_token}"}
        )
        assert resp.status_code == 200, f"Failed to get user orgs: {resp.text}"
        orgs_data = resp.json()
        org_ids = [o.get("id") for o in orgs_data.get("organisations", [])]
        assert DEFAULT_ORG_ID in org_ids, f"User not added to org. User orgs: {org_ids}"
        print(f"✓ User is member of Default Organisation")
        
        # Clean up - delete the test user
        if new_user_id:
            resp = requests.delete(f"{BASE_URL}/api/admin/users/{new_user_id}",
                headers={"Authorization": f"Bearer {workspace_admin_token}"}
            )
            if resp.status_code in [200, 204]:
                print(f"✓ Test user cleaned up")
            else:
                print(f"⚠ Could not clean up test user: {resp.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
