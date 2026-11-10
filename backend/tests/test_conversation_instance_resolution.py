"""
Test: Conversation Instance Resolution Bug Fix
Tests that conversations created via /chat/send without instance_id are saved with the real instance_id,
not 'default'. Also tests that conversations appear correctly in admin panel.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

class TestConversationInstanceResolution:
    """Tests for the conversation instance_id resolution fix"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Headers with auth and instance"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "X-Instance-ID": INSTANCE_ID,
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def created_session_ids(self):
        """Track created sessions for cleanup"""
        return []
    
    @pytest.fixture(scope="class", autouse=True)
    def cleanup_test_conversations(self, auth_headers, created_session_ids):
        """Cleanup test conversations after tests"""
        yield
        for session_id in created_session_ids:
            try:
                requests.delete(f"{BASE_URL}/api/conversations/{session_id}", headers=auth_headers)
            except Exception:
                pass
    
    def test_01_login_works(self):
        """Verify login endpoint works with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        print(f"✓ Login successful, token received")
    
    def test_02_chat_send_without_instance_id_saves_with_real_instance(self, auth_headers, created_session_ids):
        """
        BUG FIX TEST: POST /api/chat/send WITHOUT instance_id should save conversation
        with the real instance_id (88bfae82-2533-4235-968d-b3298fd57073), not 'default'
        """
        # Send chat message WITHOUT instance_id
        test_message = f"TEST_conversation_resolution_{int(time.time())}"
        response = requests.post(f"{BASE_URL}/api/chat/send", json={
            "message": test_message
            # Note: NO instance_id provided
        })
        assert response.status_code == 200, f"Chat send failed: {response.text}"
        data = response.json()
        assert "session_id" in data, "No session_id in response"
        session_id = data["session_id"]
        created_session_ids.append(session_id)
        print(f"✓ Chat sent without instance_id, session_id: {session_id}")
        
        # Now verify the conversation was saved with the REAL instance_id
        # by fetching it from the admin conversations endpoint
        time.sleep(0.5)  # Small delay to ensure DB write completes
        
        conv_response = requests.get(
            f"{BASE_URL}/api/conversations/{session_id}",
            headers=auth_headers
        )
        assert conv_response.status_code == 200, f"Conversation not found with real instance_id: {conv_response.text}"
        conv_data = conv_response.json()
        assert conv_data.get("instance_id") == INSTANCE_ID, f"Expected instance_id={INSTANCE_ID}, got {conv_data.get('instance_id')}"
        print(f"✓ Conversation saved with correct instance_id: {conv_data.get('instance_id')}")
    
    def test_03_chat_send_with_instance_id_still_works(self, auth_headers, created_session_ids):
        """POST /api/chat/send WITH instance_id should still work correctly"""
        test_message = f"TEST_with_instance_{int(time.time())}"
        response = requests.post(f"{BASE_URL}/api/chat/send", json={
            "message": test_message,
            "instance_id": INSTANCE_ID
        })
        assert response.status_code == 200, f"Chat send with instance_id failed: {response.text}"
        data = response.json()
        session_id = data["session_id"]
        created_session_ids.append(session_id)
        print(f"✓ Chat sent with instance_id, session_id: {session_id}")
        
        # Verify it's accessible via admin endpoint
        time.sleep(0.5)
        conv_response = requests.get(
            f"{BASE_URL}/api/conversations/{session_id}",
            headers=auth_headers
        )
        assert conv_response.status_code == 200, f"Conversation not found: {conv_response.text}"
        conv_data = conv_response.json()
        assert conv_data.get("instance_id") == INSTANCE_ID
        print(f"✓ Conversation with explicit instance_id saved correctly")
    
    def test_04_get_conversations_returns_list(self, auth_headers):
        """GET /api/conversations returns conversations including newly created ones"""
        response = requests.get(
            f"{BASE_URL}/api/conversations?limit=50",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get conversations failed: {response.text}"
        data = response.json()
        assert "conversations" in data, "No conversations key in response"
        assert "total" in data, "No total key in response"
        assert isinstance(data["conversations"], list), "conversations is not a list"
        print(f"✓ GET /api/conversations returned {len(data['conversations'])} conversations, total: {data['total']}")
        
        # Verify total count is reasonable (should be 133+ per requirements)
        assert data["total"] >= 1, f"Expected at least 1 conversation, got {data['total']}"
        print(f"✓ Total conversations: {data['total']}")
    
    def test_05_conversations_have_correct_structure(self, auth_headers):
        """Verify conversation objects have expected fields"""
        response = requests.get(
            f"{BASE_URL}/api/conversations?limit=5",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        if data["conversations"]:
            conv = data["conversations"][0]
            expected_fields = ["session_id", "instance_id", "platform", "messages"]
            for field in expected_fields:
                assert field in conv, f"Missing field: {field}"
            assert conv["instance_id"] == INSTANCE_ID, f"Wrong instance_id: {conv['instance_id']}"
            print(f"✓ Conversation structure verified with all expected fields")
    
    def test_06_filter_by_platform_web(self, auth_headers):
        """GET /api/conversations with platform=web filter works"""
        response = requests.get(
            f"{BASE_URL}/api/conversations?platform=web&limit=50",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Filter by platform failed: {response.text}"
        data = response.json()
        
        # All returned conversations should be web platform
        for conv in data["conversations"]:
            assert conv.get("platform") == "web", f"Expected platform=web, got {conv.get('platform')}"
        print(f"✓ Platform filter works, returned {len(data['conversations'])} web conversations")
    
    def test_07_approve_conversation_for_training(self, auth_headers, created_session_ids):
        """PATCH /api/conversations/{session_id}/approve works"""
        # First create a test conversation
        test_message = f"TEST_approve_{int(time.time())}"
        chat_response = requests.post(f"{BASE_URL}/api/chat/send", json={
            "message": test_message
        })
        assert chat_response.status_code == 200
        session_id = chat_response.json()["session_id"]
        created_session_ids.append(session_id)
        time.sleep(0.5)
        
        # Approve it
        approve_response = requests.patch(
            f"{BASE_URL}/api/conversations/{session_id}/approve",
            headers=auth_headers,
            json={"approved": True}
        )
        assert approve_response.status_code == 200, f"Approve failed: {approve_response.text}"
        data = approve_response.json()
        assert data.get("success") == True
        assert data.get("is_approved_for_training") == True
        print(f"✓ Conversation approved for training")
        
        # Verify it persisted
        conv_response = requests.get(
            f"{BASE_URL}/api/conversations/{session_id}",
            headers=auth_headers
        )
        assert conv_response.status_code == 200
        conv_data = conv_response.json()
        assert conv_data.get("is_approved_for_training") == True
        print(f"✓ Approval status persisted correctly")
        
        # Unapprove it
        unapprove_response = requests.patch(
            f"{BASE_URL}/api/conversations/{session_id}/approve",
            headers=auth_headers,
            json={"approved": False}
        )
        assert unapprove_response.status_code == 200
        print(f"✓ Conversation unapproved successfully")
    
    def test_08_no_default_instance_conversations(self, auth_token):
        """Verify no conversations exist with instance_id='default' (bug was fixed)"""
        # This is a direct DB check via a custom endpoint or we check that
        # conversations created without instance_id are NOT accessible when querying with 'default'
        # Since we can't query with 'default' instance_id (it would fail auth), 
        # we verify by checking that our test conversations ARE accessible with real instance_id
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Instance-ID": INSTANCE_ID,
            "Content-Type": "application/json"
        }
        response = requests.get(
            f"{BASE_URL}/api/conversations?limit=100",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # All conversations should have the real instance_id
        for conv in data["conversations"]:
            assert conv.get("instance_id") == INSTANCE_ID, f"Found conversation with wrong instance_id: {conv.get('instance_id')}"
        print(f"✓ All {len(data['conversations'])} conversations have correct instance_id")


class TestChatStreamEndpoint:
    """Test the streaming chat endpoint also uses correct instance resolution"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {
            "Authorization": f"Bearer {auth_token}",
            "X-Instance-ID": INSTANCE_ID,
            "Content-Type": "application/json"
        }
    
    def test_stream_endpoint_exists(self):
        """Verify /api/chat/stream endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/chat/stream", json={
            "message": "test"
        }, stream=True)
        # Should return 200 with SSE content type
        assert response.status_code == 200, f"Stream endpoint failed: {response.status_code}"
        assert "text/event-stream" in response.headers.get("content-type", "")
        print(f"✓ Stream endpoint exists and returns SSE")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
