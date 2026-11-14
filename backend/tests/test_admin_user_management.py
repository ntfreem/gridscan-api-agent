"""
Backend tests for Admin User Management features:
- Admin login
- Invite user with extended details (first_name, last_name, username)
- Get invite details
- Accept invite
- Admin password reset
- User login after invite acceptance
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"


class TestAdminLogin:
    """Test admin login functionality"""
    
    def test_admin_login_success(self):
        """Admin can log in with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        print(f"Admin login response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "superadmin", "Admin should have superadmin role"
        print(f"Admin login successful, user: {data['user'].get('email')}")
        
    def test_admin_login_invalid_password(self):
        """Admin login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": "WrongPassword123"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestInviteUserFlow:
    """Test the complete invite user flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, "Admin login failed"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Generate unique test data
        self.test_id = str(uuid.uuid4())[:8]
        self.test_email = f"TEST_invite_{self.test_id}@example.com"
        self.test_username = f"test_user_{self.test_id}"
        self.test_first_name = "TestFirst"
        self.test_last_name = "TestLast"
        self.test_password = "TestPass@123"
        
        # Track created resources for cleanup
        self.created_invite_token = None
        self.created_user_id = None
        yield
        
        # Cleanup: delete test user if created
        if self.created_user_id:
            try:
                requests.delete(
                    f"{BASE_URL}/api/admin/users/{self.created_user_id}",
                    headers=self.headers
                )
            except Exception:
                pass
    
    def test_invite_user_with_extended_details(self):
        """Admin can invite user with first_name, last_name, username"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={**self.headers, "Content-Type": "application/json"},
            json={
                "email": self.test_email,
                "role": "user",
                "first_name": self.test_first_name,
                "last_name": self.test_last_name,
                "username": self.test_username,
            }
        )
        print(f"Invite response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Invite should succeed"
        assert "token" in data, "Response should contain invite token"
        self.created_invite_token = data["token"]
        print(f"Invite created with token: {self.created_invite_token[:20]}...")
        
    def test_invite_user_email_required(self):
        """Invite fails without email"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={**self.headers, "Content-Type": "application/json"},
            json={
                "email": "",
                "role": "user",
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
    def test_invite_user_invalid_role(self):
        """Invite fails with invalid role"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={**self.headers, "Content-Type": "application/json"},
            json={
                "email": f"TEST_invalid_role_{self.test_id}@example.com",
                "role": "invalid_role",
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"


class TestGetInviteDetails:
    """Test getting invite details"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create an invite to test with"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, "Admin login failed"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create test invite
        self.test_id = str(uuid.uuid4())[:8]
        self.test_email = f"TEST_details_{self.test_id}@example.com"
        self.test_first_name = "DetailFirst"
        self.test_last_name = "DetailLast"
        self.test_username = f"detail_user_{self.test_id}"
        
        response = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={**self.headers, "Content-Type": "application/json"},
            json={
                "email": self.test_email,
                "role": "user",
                "first_name": self.test_first_name,
                "last_name": self.test_last_name,
                "username": self.test_username,
            }
        )
        assert response.status_code == 200, f"Failed to create invite: {response.text}"
        self.invite_token = response.json()["token"]
        yield
        
        # Cleanup: revoke invite if still pending
        try:
            requests.delete(
                f"{BASE_URL}/api/admin/users/invitations/{self.invite_token}",
                headers=self.headers
            )
        except Exception:
            pass
    
    def test_get_invite_details_returns_extended_fields(self):
        """GET /invite/{token} returns first_name, last_name, username"""
        response = requests.get(f"{BASE_URL}/api/invite/{self.invite_token}")
        print(f"Get invite details response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Backend lowercases emails
        assert data.get("email") == self.test_email.lower(), "Email should match (lowercased)"
        assert data.get("first_name") == self.test_first_name, f"first_name should be {self.test_first_name}, got {data.get('first_name')}"
        assert data.get("last_name") == self.test_last_name, f"last_name should be {self.test_last_name}, got {data.get('last_name')}"
        assert data.get("username") == self.test_username, f"username should be {self.test_username}, got {data.get('username')}"
        assert data.get("role") == "user", "Role should be user"
        print(f"Invite details verified: {data}")
        
    def test_get_invite_details_invalid_token(self):
        """GET /invite/{token} returns 404 for invalid token"""
        response = requests.get(f"{BASE_URL}/api/invite/invalid_token_12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestAcceptInvite:
    """Test accepting an invite"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create an invite to accept"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, "Admin login failed"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create test invite
        self.test_id = str(uuid.uuid4())[:8]
        self.test_email = f"TEST_accept_{self.test_id}@example.com"
        self.test_first_name = "AcceptFirst"
        self.test_last_name = "AcceptLast"
        self.test_username = f"accept_user_{self.test_id}"
        self.test_password = "AcceptPass@123"
        
        response = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={**self.headers, "Content-Type": "application/json"},
            json={
                "email": self.test_email,
                "role": "user",
                "first_name": self.test_first_name,
                "last_name": self.test_last_name,
                "username": self.test_username,
            }
        )
        assert response.status_code == 200, f"Failed to create invite: {response.text}"
        self.invite_token = response.json()["token"]
        self.created_user_id = None
        yield
        
        # Cleanup: delete created user
        if self.created_user_id:
            try:
                requests.delete(
                    f"{BASE_URL}/api/admin/users/{self.created_user_id}",
                    headers=self.headers
                )
            except Exception:
                pass
    
    def test_accept_invite_creates_user(self):
        """POST /invite/{token}/accept creates user account"""
        response = requests.post(
            f"{BASE_URL}/api/invite/{self.invite_token}/accept",
            json={
                "username": self.test_username,
                "password": self.test_password,
                "first_name": self.test_first_name,
                "last_name": self.test_last_name,
            }
        )
        print(f"Accept invite response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Accept should succeed"
        # Backend lowercases emails
        assert data.get("email") == self.test_email.lower(), "Email should match (lowercased)"
        
        # Verify user can login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": self.test_username,
            "password": self.test_password
        })
        print(f"New user login response: {login_response.status_code}")
        assert login_response.status_code == 200, f"New user should be able to login: {login_response.text}"
        
        login_data = login_response.json()
        self.created_user_id = login_data["user"]["id"]
        # Backend lowercases emails
        assert login_data["user"]["email"] == self.test_email.lower()
        assert login_data["user"]["username"] == self.test_username
        print(f"User created and logged in successfully: {login_data['user']}")
        
    def test_accept_invite_username_required(self):
        """Accept invite fails without username"""
        # Create another invite for this test
        test_id2 = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={**self.headers, "Content-Type": "application/json"},
            json={
                "email": f"TEST_no_username_{test_id2}@example.com",
                "role": "user",
            }
        )
        assert response.status_code == 200
        token = response.json()["token"]
        
        # Try to accept without username
        response = requests.post(
            f"{BASE_URL}/api/invite/{token}/accept",
            json={
                "username": "",
                "password": "TestPass@123",
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
    def test_accept_invite_password_too_short(self):
        """Accept invite fails with short password"""
        # Create another invite for this test
        test_id2 = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={**self.headers, "Content-Type": "application/json"},
            json={
                "email": f"TEST_short_pw_{test_id2}@example.com",
                "role": "user",
            }
        )
        assert response.status_code == 200
        token = response.json()["token"]
        
        # Try to accept with short password
        response = requests.post(
            f"{BASE_URL}/api/invite/{token}/accept",
            json={
                "username": f"short_pw_{test_id2}",
                "password": "12345",  # Less than 6 chars
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"


class TestAdminPasswordReset:
    """Test admin password reset functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test user to reset password for"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, "Admin login failed"
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create test user via invite flow
        self.test_id = str(uuid.uuid4())[:8]
        self.test_email = f"TEST_reset_{self.test_id}@example.com"
        self.test_username = f"reset_user_{self.test_id}"
        self.original_password = "OriginalPass@123"
        self.new_password = "NewResetPass@456"
        
        # Create invite
        response = requests.post(
            f"{BASE_URL}/api/admin/users/invite",
            headers={**self.headers, "Content-Type": "application/json"},
            json={
                "email": self.test_email,
                "role": "user",
                "username": self.test_username,
            }
        )
        assert response.status_code == 200, f"Failed to create invite: {response.text}"
        invite_token = response.json()["token"]
        
        # Accept invite to create user
        response = requests.post(
            f"{BASE_URL}/api/invite/{invite_token}/accept",
            json={
                "username": self.test_username,
                "password": self.original_password,
            }
        )
        assert response.status_code == 200, f"Failed to accept invite: {response.text}"
        
        # Get user ID by logging in
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": self.test_username,
            "password": self.original_password
        })
        assert response.status_code == 200, f"Failed to login as new user: {response.text}"
        self.test_user_id = response.json()["user"]["id"]
        
        yield
        
        # Cleanup: delete test user
        try:
            requests.delete(
                f"{BASE_URL}/api/admin/users/{self.test_user_id}",
                headers=self.headers
            )
        except Exception:
            pass
    
    def test_admin_reset_password_success(self):
        """Admin can reset another user's password"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{self.test_user_id}/reset-password",
            headers={**self.headers, "Content-Type": "application/json"},
            json={"new_password": self.new_password}
        )
        print(f"Reset password response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Reset should succeed"
        
        # Verify old password no longer works
        old_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": self.test_username,
            "password": self.original_password
        })
        assert old_login.status_code == 401, "Old password should not work"
        
        # Verify new password works
        new_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": self.test_username,
            "password": self.new_password
        })
        print(f"Login with new password: {new_login.status_code}")
        assert new_login.status_code == 200, f"New password should work: {new_login.text}"
        print("Password reset verified successfully")
        
    def test_admin_reset_password_too_short(self):
        """Admin reset fails with short password"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{self.test_user_id}/reset-password",
            headers={**self.headers, "Content-Type": "application/json"},
            json={"new_password": "12345"}  # Less than 6 chars
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
    def test_admin_reset_password_user_not_found(self):
        """Admin reset fails for non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/nonexistent-user-id/reset-password",
            headers={**self.headers, "Content-Type": "application/json"},
            json={"new_password": "ValidPass@123"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestListUsers:
    """Test listing users for Team page"""
    
    def test_list_users_returns_user_details(self):
        """GET /admin/users returns users with extended details"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, "Admin login failed"
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get users list
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        print(f"List users response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        users = response.json()
        assert isinstance(users, list), "Response should be a list"
        assert len(users) > 0, "Should have at least one user (admin)"
        
        # Check that users have expected fields
        admin_user = next((u for u in users if u.get("username") == "administrator"), None)
        assert admin_user is not None, "Admin user should be in list"
        
        # Verify user structure has expected fields
        expected_fields = ["id", "email", "username", "role", "is_verified"]
        for field in expected_fields:
            assert field in admin_user, f"User should have {field} field"
        
        print(f"Found {len(users)} users, admin user verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
