"""
Test suite for User Invitation System
Tests: POST /api/admin/users/invite, GET /api/invite/{token}, POST /api/invite/{token}/accept,
       DELETE /api/admin/users/invitations/{token}
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL_OR_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": ADMIN_EMAIL_OR_USERNAME,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers for admin API calls."""
    return {
        "Authorization": f"Bearer {admin_token}",
        "X-Instance-ID": INSTANCE_ID,
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def created_invites():
    """Track created invites for cleanup."""
    return []


@pytest.fixture(scope="module")
def created_users():
    """Track created users for cleanup."""
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_headers, created_invites, created_users):
    """Cleanup created invites and users after tests."""
    yield
    # Cleanup invites
    for token in created_invites:
        try:
            requests.delete(f"{BASE_URL}/api/admin/users/invitations/{token}", headers=admin_headers)
        except Exception:
            pass
    # Cleanup users - delete TEST_ users created during tests
    for user_id in created_users:
        try:
            requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers)
        except Exception:
            pass


class TestInviteUserEndpoint:
    """Tests for POST /api/admin/users/invite"""

    def test_invite_user_success(self, admin_headers, created_invites):
        """Test successful user invitation with email and role."""
        unique_email = f"TEST_invitetest_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/admin/users/invite", 
            headers=admin_headers,
            json={"email": unique_email, "role": "user"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert "token" in data
        assert "message" in data
        # Email is lowercased by backend
        assert unique_email.lower() in data["message"].lower()
        created_invites.append(data["token"])
        print(f"✓ Invite sent successfully to {unique_email}, token: {data['token'][:20]}...")

    def test_invite_user_as_admin_role(self, admin_headers, created_invites):
        """Test inviting a user with superadmin role."""
        unique_email = f"TEST_admintest_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": unique_email, "role": "superadmin"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert "token" in data
        created_invites.append(data["token"])
        print(f"✓ Admin invite sent successfully to {unique_email}")

    def test_invite_user_with_instance_assignment(self, admin_headers, created_invites):
        """Test inviting a user with pre-assigned instance."""
        unique_email = f"TEST_insttest_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": unique_email, "role": "user", "instance_id": INSTANCE_ID}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert "token" in data
        created_invites.append(data["token"])
        print(f"✓ Invite with instance assignment sent to {unique_email}")

    def test_invite_rejects_duplicate_email_registered(self, admin_headers):
        """Test that inviting an already registered email is rejected."""
        # Use the admin email which is already registered
        response = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": "admin@bridgebot.tech", "role": "user"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "already registered" in data.get("detail", "").lower()
        print(f"✓ Correctly rejected duplicate registered email")

    def test_invite_rejects_invalid_role(self, admin_headers):
        """Test that invalid roles are rejected."""
        unique_email = f"TEST_invalidrole_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": unique_email, "role": "invalid_role"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "role" in data.get("detail", "").lower()
        print(f"✓ Correctly rejected invalid role")

    def test_invite_rejects_invalid_email(self, admin_headers):
        """Test that invalid email format is rejected."""
        response = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": "not-an-email", "role": "user"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ Correctly rejected invalid email format")

    def test_invite_rejects_invalid_instance(self, admin_headers):
        """Test that non-existent instance_id is rejected."""
        unique_email = f"TEST_badinst_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": unique_email, "role": "user", "instance_id": "non-existent-instance-id"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "instance" in data.get("detail", "").lower()
        print(f"✓ Correctly rejected non-existent instance")

    def test_invite_requires_admin_auth(self):
        """Test that invite endpoint requires admin authentication."""
        response = requests.post(f"{BASE_URL}/api/admin/users/invite",
            json={"email": "test@example.com", "role": "user"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Correctly requires admin authentication")


class TestGetInviteDetails:
    """Tests for GET /api/invite/{token}"""

    def test_get_invite_details_valid_token(self, admin_headers, created_invites):
        """Test getting invite details with a valid token."""
        # First create an invite
        unique_email = f"TEST_getdetails_{uuid.uuid4().hex[:8]}@example.com"
        create_resp = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": unique_email, "role": "user"}
        )
        assert create_resp.status_code == 200
        token = create_resp.json()["token"]
        created_invites.append(token)

        # Get invite details (public endpoint - no auth needed)
        response = requests.get(f"{BASE_URL}/api/invite/{token}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Email is lowercased by backend
        assert data.get("email") == unique_email.lower()
        assert data.get("role") == "user"
        assert "invited_by_email" in data
        print(f"✓ Got invite details: email={data['email']}, role={data['role']}")

    def test_get_invite_details_invalid_token(self):
        """Test getting invite details with an invalid token returns 404."""
        response = requests.get(f"{BASE_URL}/api/invite/invalid-token-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ Correctly returned 404 for invalid token")


class TestAcceptInvite:
    """Tests for POST /api/invite/{token}/accept"""

    def test_accept_invite_success(self, admin_headers, created_invites, created_users):
        """Test successfully accepting an invitation and creating account."""
        # Create an invite WITH instance assignment so user can login
        unique_email = f"TEST_accept_{uuid.uuid4().hex[:8]}@example.com"
        unique_username = f"TEST_user_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": unique_email, "role": "user", "instance_id": INSTANCE_ID}
        )
        assert create_resp.status_code == 200
        token = create_resp.json()["token"]
        created_invites.append(token)

        # Accept the invite
        response = requests.post(f"{BASE_URL}/api/invite/{token}/accept",
            json={"username": unique_username, "password": "TestPass123"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        # Email is lowercased by backend
        assert data.get("email") == unique_email.lower()
        print(f"✓ Account created successfully for {unique_email}")

        # Verify user can login (needs instance assignment to avoid 403)
        login_resp = requests.post(f"{BASE_URL}/api/auth/login",
            json={"email_or_username": unique_username, "password": "TestPass123"}
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.status_code}: {login_resp.text}"
        login_data = login_resp.json()
        # User was created with correct role
        assert login_data.get("user", {}).get("role") == "user"
        # User has token (can login successfully)
        assert "token" in login_data
        created_users.append(login_data.get("user", {}).get("id"))
        print(f"✓ User can login and has correct role")

    def test_accept_invite_with_instance_assignment(self, admin_headers, created_invites, created_users):
        """Test that accepting invite with instance_id assigns user to instance."""
        unique_email = f"TEST_instaccept_{uuid.uuid4().hex[:8]}@example.com"
        unique_username = f"TEST_instuser_{uuid.uuid4().hex[:8]}"
        
        # Create invite with instance
        create_resp = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": unique_email, "role": "user", "instance_id": INSTANCE_ID}
        )
        assert create_resp.status_code == 200
        token = create_resp.json()["token"]
        created_invites.append(token)

        # Accept the invite
        response = requests.post(f"{BASE_URL}/api/invite/{token}/accept",
            json={"username": unique_username, "password": "TestPass123"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Login and verify instance assignment
        login_resp = requests.post(f"{BASE_URL}/api/auth/login",
            json={"email_or_username": unique_username, "password": "TestPass123"}
        )
        assert login_resp.status_code == 200
        login_data = login_resp.json()
        created_users.append(login_data.get("user", {}).get("id"))
        
        # Check that user has instance assigned
        instances = login_data.get("instances", [])
        instance_ids = [i.get("id") for i in instances]
        assert INSTANCE_ID in instance_ids, f"Instance {INSTANCE_ID} not in user's instances: {instance_ids}"
        print(f"✓ User correctly assigned to instance on invite accept")

    def test_accept_invite_rejects_duplicate_username(self, admin_headers, created_invites):
        """Test that accepting with an existing username is rejected."""
        # Create first invite and accept it
        email1 = f"TEST_dup1_{uuid.uuid4().hex[:8]}@example.com"
        shared_username = f"TEST_shared_{uuid.uuid4().hex[:8]}"
        
        create_resp1 = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": email1, "role": "user"}
        )
        assert create_resp1.status_code == 200
        token1 = create_resp1.json()["token"]
        created_invites.append(token1)
        
        accept_resp1 = requests.post(f"{BASE_URL}/api/invite/{token1}/accept",
            json={"username": shared_username, "password": "TestPass123"}
        )
        assert accept_resp1.status_code == 200

        # Create second invite and try to accept with same username
        email2 = f"TEST_dup2_{uuid.uuid4().hex[:8]}@example.com"
        create_resp2 = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": email2, "role": "user"}
        )
        assert create_resp2.status_code == 200
        token2 = create_resp2.json()["token"]
        created_invites.append(token2)

        accept_resp2 = requests.post(f"{BASE_URL}/api/invite/{token2}/accept",
            json={"username": shared_username, "password": "TestPass123"}
        )
        assert accept_resp2.status_code == 400, f"Expected 400, got {accept_resp2.status_code}: {accept_resp2.text}"
        assert "username" in accept_resp2.json().get("detail", "").lower()
        print(f"✓ Correctly rejected duplicate username")

    def test_accept_invite_rejects_short_password(self, admin_headers, created_invites):
        """Test that passwords shorter than 6 characters are rejected."""
        unique_email = f"TEST_shortpw_{uuid.uuid4().hex[:8]}@example.com"
        create_resp = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": unique_email, "role": "user"}
        )
        assert create_resp.status_code == 200
        token = create_resp.json()["token"]
        created_invites.append(token)

        response = requests.post(f"{BASE_URL}/api/invite/{token}/accept",
            json={"username": f"TEST_user_{uuid.uuid4().hex[:8]}", "password": "12345"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "password" in response.json().get("detail", "").lower()
        print(f"✓ Correctly rejected short password")

    def test_accept_invite_marks_as_accepted(self, admin_headers, created_invites):
        """Test that accepting an invite marks it as 'accepted' so it cannot be reused."""
        unique_email = f"TEST_markaccept_{uuid.uuid4().hex[:8]}@example.com"
        unique_username = f"TEST_markuser_{uuid.uuid4().hex[:8]}"
        
        create_resp = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": unique_email, "role": "user"}
        )
        assert create_resp.status_code == 200
        token = create_resp.json()["token"]
        created_invites.append(token)

        # Accept the invite
        accept_resp = requests.post(f"{BASE_URL}/api/invite/{token}/accept",
            json={"username": unique_username, "password": "TestPass123"}
        )
        assert accept_resp.status_code == 200

        # Try to get invite details again - should fail
        get_resp = requests.get(f"{BASE_URL}/api/invite/{token}")
        assert get_resp.status_code == 400, f"Expected 400, got {get_resp.status_code}: {get_resp.text}"
        assert "accepted" in get_resp.json().get("detail", "").lower()
        print(f"✓ Invite correctly marked as accepted and cannot be reused")

    def test_accept_invite_already_used_token(self, admin_headers, created_invites):
        """Test that accepting an already-used token returns an error."""
        unique_email = f"TEST_reuse_{uuid.uuid4().hex[:8]}@example.com"
        unique_username = f"TEST_reuseuser_{uuid.uuid4().hex[:8]}"
        
        create_resp = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": unique_email, "role": "user"}
        )
        assert create_resp.status_code == 200
        token = create_resp.json()["token"]
        created_invites.append(token)

        # Accept the invite first time
        accept_resp1 = requests.post(f"{BASE_URL}/api/invite/{token}/accept",
            json={"username": unique_username, "password": "TestPass123"}
        )
        assert accept_resp1.status_code == 200

        # Try to accept again
        accept_resp2 = requests.post(f"{BASE_URL}/api/invite/{token}/accept",
            json={"username": f"TEST_another_{uuid.uuid4().hex[:8]}", "password": "TestPass123"}
        )
        assert accept_resp2.status_code == 400, f"Expected 400, got {accept_resp2.status_code}: {accept_resp2.text}"
        assert "accepted" in accept_resp2.json().get("detail", "").lower()
        print(f"✓ Correctly rejected reuse of already-accepted token")

    def test_accept_invite_invalid_token(self):
        """Test that accepting with an invalid token returns 404."""
        response = requests.post(f"{BASE_URL}/api/invite/invalid-token-xyz/accept",
            json={"username": "testuser", "password": "TestPass123"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ Correctly returned 404 for invalid token")


class TestRevokeInvitation:
    """Tests for DELETE /api/admin/users/invitations/{token}"""

    def test_revoke_pending_invitation(self, admin_headers, created_invites):
        """Test revoking a pending invitation."""
        unique_email = f"TEST_revoke_{uuid.uuid4().hex[:8]}@example.com"
        create_resp = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": unique_email, "role": "user"}
        )
        assert create_resp.status_code == 200
        token = create_resp.json()["token"]

        # Revoke the invitation
        revoke_resp = requests.delete(f"{BASE_URL}/api/admin/users/invitations/{token}",
            headers=admin_headers
        )
        assert revoke_resp.status_code == 200, f"Expected 200, got {revoke_resp.status_code}: {revoke_resp.text}"
        data = revoke_resp.json()
        assert data.get("success") is True
        print(f"✓ Invitation revoked successfully")

        # Verify invite cannot be used
        get_resp = requests.get(f"{BASE_URL}/api/invite/{token}")
        assert get_resp.status_code == 400, f"Expected 400, got {get_resp.status_code}: {get_resp.text}"
        assert "revoked" in get_resp.json().get("detail", "").lower()
        print(f"✓ Revoked invitation cannot be used")

    def test_revoke_nonexistent_invitation(self, admin_headers):
        """Test revoking a non-existent invitation returns 404."""
        response = requests.delete(f"{BASE_URL}/api/admin/users/invitations/nonexistent-token",
            headers=admin_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ Correctly returned 404 for non-existent invitation")

    def test_revoke_requires_admin_auth(self):
        """Test that revoke endpoint requires admin authentication."""
        response = requests.delete(f"{BASE_URL}/api/admin/users/invitations/some-token")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Correctly requires admin authentication")


class TestListInvitations:
    """Tests for GET /api/admin/users/invitations"""

    def test_list_invitations(self, admin_headers):
        """Test listing all invitations."""
        response = requests.get(f"{BASE_URL}/api/admin/users/invitations", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "invitations" in data
        assert isinstance(data["invitations"], list)
        print(f"✓ Listed {len(data['invitations'])} invitations")

    def test_list_invitations_requires_admin(self):
        """Test that list invitations requires admin auth."""
        response = requests.get(f"{BASE_URL}/api/admin/users/invitations")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Correctly requires admin authentication")


class TestRoleToggle:
    """Tests for PATCH /api/admin/users/{user_id}/role"""

    def test_promote_user_to_admin(self, admin_headers, created_invites, created_users):
        """Test promoting a user to admin role."""
        # Create and accept an invite WITH instance assignment so user can login
        unique_email = f"TEST_promote_{uuid.uuid4().hex[:8]}@example.com"
        unique_username = f"TEST_promoteuser_{uuid.uuid4().hex[:8]}"
        
        create_resp = requests.post(f"{BASE_URL}/api/admin/users/invite",
            headers=admin_headers,
            json={"email": unique_email, "role": "user", "instance_id": INSTANCE_ID}
        )
        assert create_resp.status_code == 200
        token = create_resp.json()["token"]
        created_invites.append(token)

        accept_resp = requests.post(f"{BASE_URL}/api/invite/{token}/accept",
            json={"username": unique_username, "password": "TestPass123"}
        )
        assert accept_resp.status_code == 200

        # Get user ID (user needs instance to login)
        login_resp = requests.post(f"{BASE_URL}/api/auth/login",
            json={"email_or_username": unique_username, "password": "TestPass123"}
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.status_code}: {login_resp.text}"
        user_id = login_resp.json().get("user", {}).get("id")
        created_users.append(user_id)

        # Promote to admin
        promote_resp = requests.patch(f"{BASE_URL}/api/admin/users/{user_id}/role",
            headers=admin_headers,
            json={"role": "superadmin"}
        )
        assert promote_resp.status_code == 200, f"Expected 200, got {promote_resp.status_code}: {promote_resp.text}"
        
        # Verify role changed (superadmin can login without instance)
        login_resp2 = requests.post(f"{BASE_URL}/api/auth/login",
            json={"email_or_username": unique_username, "password": "TestPass123"}
        )
        assert login_resp2.status_code == 200
        assert login_resp2.json().get("user", {}).get("role") == "superadmin"
        print(f"✓ User promoted to admin successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
