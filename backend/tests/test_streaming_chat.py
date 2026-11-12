"""
Test suite for BitBot Pro Streaming Chat functionality.
Tests SSE streaming endpoints for web chat, widget, and external API.
"""
import pytest
import requests
import os
import json
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code == 200:
        return resp.json().get("token")
    pytest.skip(f"Authentication failed: {resp.status_code} - {resp.text}")


@pytest.fixture(scope="module")
def api_key(auth_token):
    """Create a bbk_ API key for external API testing."""
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "X-Instance-ID": INSTANCE_ID
    }
    # First check if we have existing keys
    resp = requests.get(f"{BASE_URL}/api/admin/api-keys", headers=headers)
    if resp.status_code == 200:
        keys = resp.json()
        for key in keys:
            if key.get("is_active") and key.get("label") == "TEST_streaming_key":
                # Can't retrieve full key, need to create new one
                pass
    
    # Create a new API key for testing
    resp = requests.post(f"{BASE_URL}/api/admin/api-keys", 
        headers=headers,
        json={"instance_id": INSTANCE_ID, "label": "TEST_streaming_key"}
    )
    if resp.status_code in [200, 201]:
        data = resp.json()
        return data.get("key")
    pytest.skip(f"Failed to create API key: {resp.status_code} - {resp.text}")


class TestStreamingEndpointBasics:
    """Test basic streaming endpoint availability and format."""
    
    def test_chat_stream_endpoint_exists(self):
        """POST /api/chat/stream should exist and accept requests."""
        resp = requests.post(f"{BASE_URL}/api/chat/stream", 
            json={"message": "hello"},
            stream=True,
            timeout=30
        )
        # Should return 200 with SSE content type
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
        assert "text/event-stream" in resp.headers.get("Content-Type", ""), \
            f"Expected text/event-stream, got {resp.headers.get('Content-Type')}"
    
    def test_chat_stream_returns_sse_events(self):
        """POST /api/chat/stream should return properly formatted SSE events."""
        session_id = f"test_sse_{uuid.uuid4().hex[:8]}"
        resp = requests.post(f"{BASE_URL}/api/chat/stream",
            json={"message": "Say hello", "session_id": session_id, "instance_id": INSTANCE_ID},
            stream=True,
            timeout=60
        )
        assert resp.status_code == 200
        
        events_received = {"session": False, "token": False, "done": False}
        full_content = ""
        
        for line in resp.iter_lines(decode_unicode=True):
            if not line:
                continue
            if line.startswith("event: "):
                event_type = line[7:].strip()
                if event_type in events_received:
                    events_received[event_type] = True
            elif line.startswith("data: "):
                try:
                    data = json.loads(line[6:])
                    if "token" in data:
                        full_content += data["token"]
                except json.JSONDecodeError:
                    pass
        
        # Should receive session event first
        assert events_received["session"], "Should receive 'session' event"
        # Should receive at least one token event
        assert events_received["token"], "Should receive 'token' events"
        # Should receive done event at the end
        assert events_received["done"], "Should receive 'done' event"
        # Should have some content
        assert len(full_content) > 0, "Should receive some response content"
        print(f"Received streaming response: {full_content[:100]}...")
    
    def test_chat_stream_with_instance_id(self):
        """POST /api/chat/stream should work with instance_id parameter."""
        resp = requests.post(f"{BASE_URL}/api/chat/stream",
            json={"message": "What is this bot about?", "instance_id": INSTANCE_ID},
            stream=True,
            timeout=60
        )
        assert resp.status_code == 200
        
        # Verify we get a session event with session_id
        session_id_received = None
        for line in resp.iter_lines(decode_unicode=True):
            if line.startswith("data: "):
                try:
                    data = json.loads(line[6:])
                    if "session_id" in data:
                        session_id_received = data["session_id"]
                        break
                except json.JSONDecodeError:
                    pass
        
        assert session_id_received is not None, "Should receive session_id in session event"
        print(f"Session ID received: {session_id_received}")


class TestNonStreamingFallback:
    """Test that non-streaming endpoint still works as fallback."""
    
    def test_chat_send_endpoint_works(self):
        """POST /api/chat/send should still work (non-streaming fallback)."""
        session_id = f"test_fallback_{uuid.uuid4().hex[:8]}"
        resp = requests.post(f"{BASE_URL}/api/chat/send",
            json={"message": "Hello", "session_id": session_id, "instance_id": INSTANCE_ID},
            timeout=60
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
        data = resp.json()
        assert "response" in data, "Should have 'response' field"
        assert "session_id" in data, "Should have 'session_id' field"
        assert len(data["response"]) > 0, "Should have non-empty response"
        print(f"Non-streaming response: {data['response'][:100]}...")


class TestExternalAPIStreaming:
    """Test external API streaming with bbk_ API keys."""
    
    def test_v1_chat_stream_requires_auth(self):
        """POST /api/v1/chat/stream should require Authorization header."""
        resp = requests.post(f"{BASE_URL}/api/v1/chat/stream",
            json={"message": "hello"},
            timeout=10
        )
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"
    
    def test_v1_chat_stream_rejects_invalid_key(self):
        """POST /api/v1/chat/stream should reject invalid API keys."""
        resp = requests.post(f"{BASE_URL}/api/v1/chat/stream",
            json={"message": "hello"},
            headers={"Authorization": "Bearer bbk_invalid_key_12345"},
            timeout=10
        )
        assert resp.status_code == 401, f"Expected 401 with invalid key, got {resp.status_code}"
    
    def test_v1_chat_stream_with_valid_key(self, api_key):
        """POST /api/v1/chat/stream should work with valid bbk_ key."""
        if not api_key:
            pytest.skip("No API key available")
        
        resp = requests.post(f"{BASE_URL}/api/v1/chat/stream",
            json={"message": "Hello from external API"},
            headers={"Authorization": f"Bearer {api_key}"},
            stream=True,
            timeout=60
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
        assert "text/event-stream" in resp.headers.get("Content-Type", "")
        
        events_received = {"session": False, "token": False, "done": False}
        for line in resp.iter_lines(decode_unicode=True):
            if line.startswith("event: "):
                event_type = line[7:].strip()
                if event_type in events_received:
                    events_received[event_type] = True
        
        assert events_received["session"], "Should receive 'session' event"
        assert events_received["done"], "Should receive 'done' event"
        print("External API streaming works with valid bbk_ key")


class TestMultiTurnStreaming:
    """Test multi-turn conversation with streaming."""
    
    def test_multi_turn_same_session(self):
        """Send 2 messages in sequence to same session_id, both should stream correctly."""
        session_id = f"test_multiturn_{uuid.uuid4().hex[:8]}"
        
        # First message
        resp1 = requests.post(f"{BASE_URL}/api/chat/stream",
            json={"message": "My name is TestUser", "session_id": session_id, "instance_id": INSTANCE_ID},
            stream=True,
            timeout=60
        )
        assert resp1.status_code == 200
        
        response1_content = ""
        for line in resp1.iter_lines(decode_unicode=True):
            if line.startswith("data: "):
                try:
                    data = json.loads(line[6:])
                    if "token" in data:
                        response1_content += data["token"]
                except json.JSONDecodeError:
                    pass
        
        assert len(response1_content) > 0, "First message should get response"
        print(f"First response: {response1_content[:100]}...")
        
        # Second message - same session
        resp2 = requests.post(f"{BASE_URL}/api/chat/stream",
            json={"message": "What is my name?", "session_id": session_id, "instance_id": INSTANCE_ID},
            stream=True,
            timeout=60
        )
        assert resp2.status_code == 200
        
        response2_content = ""
        done_received = False
        for line in resp2.iter_lines(decode_unicode=True):
            if line.startswith("event: done"):
                done_received = True
            elif line.startswith("data: "):
                try:
                    data = json.loads(line[6:])
                    if "token" in data:
                        response2_content += data["token"]
                except json.JSONDecodeError:
                    pass
        
        assert len(response2_content) > 0, "Second message should get response"
        assert done_received, "Should receive done event for second message"
        print(f"Second response: {response2_content[:100]}...")


class TestStreamingErrorHandling:
    """Test error handling in streaming responses."""
    
    def test_empty_message_handling(self):
        """Streaming should handle empty messages gracefully."""
        resp = requests.post(f"{BASE_URL}/api/chat/stream",
            json={"message": "", "instance_id": INSTANCE_ID},
            stream=True,
            timeout=30
        )
        # Should either return 400/422 or handle gracefully with error event
        # Accept both behaviors
        if resp.status_code in [400, 422]:
            print("Empty message rejected with validation error")
        else:
            assert resp.status_code == 200
            # Check if we get an error event or a response
            has_response = False
            for line in resp.iter_lines(decode_unicode=True):
                if line.startswith("event: "):
                    has_response = True
            assert has_response, "Should get some response for empty message"
    
    def test_stream_headers_correct(self):
        """Streaming response should have correct headers for SSE."""
        resp = requests.post(f"{BASE_URL}/api/chat/stream",
            json={"message": "test", "instance_id": INSTANCE_ID},
            stream=True,
            timeout=30
        )
        assert resp.status_code == 200
        
        # Check required SSE headers
        content_type = resp.headers.get("Content-Type", "")
        assert "text/event-stream" in content_type, f"Content-Type should be text/event-stream, got {content_type}"
        
        # Cache-Control should be no-cache for SSE
        cache_control = resp.headers.get("Cache-Control", "")
        assert "no-cache" in cache_control.lower(), f"Cache-Control should include no-cache, got {cache_control}"


class TestSSEEventFormat:
    """Test SSE event format compliance."""
    
    def test_session_event_format(self):
        """Session event should have correct format with session_id."""
        resp = requests.post(f"{BASE_URL}/api/chat/stream",
            json={"message": "hi", "instance_id": INSTANCE_ID},
            stream=True,
            timeout=60
        )
        assert resp.status_code == 200
        
        session_event_found = False
        session_data = None
        
        current_event = None
        for line in resp.iter_lines(decode_unicode=True):
            if line.startswith("event: "):
                current_event = line[7:].strip()
            elif line.startswith("data: ") and current_event == "session":
                try:
                    session_data = json.loads(line[6:])
                    session_event_found = True
                    break
                except json.JSONDecodeError:
                    pass
        
        assert session_event_found, "Should find session event"
        assert "session_id" in session_data, "Session event should contain session_id"
        assert isinstance(session_data["session_id"], str), "session_id should be a string"
        assert len(session_data["session_id"]) > 0, "session_id should not be empty"
        print(f"Session event format correct: {session_data}")
    
    def test_token_event_format(self):
        """Token events should have correct format with token field."""
        resp = requests.post(f"{BASE_URL}/api/chat/stream",
            json={"message": "Say hello world", "instance_id": INSTANCE_ID},
            stream=True,
            timeout=60
        )
        assert resp.status_code == 200
        
        token_events = []
        current_event = None
        
        for line in resp.iter_lines(decode_unicode=True):
            if line.startswith("event: "):
                current_event = line[7:].strip()
            elif line.startswith("data: ") and current_event == "token":
                try:
                    data = json.loads(line[6:])
                    token_events.append(data)
                except json.JSONDecodeError:
                    pass
        
        assert len(token_events) > 0, "Should receive token events"
        for event in token_events[:5]:  # Check first 5
            assert "token" in event, f"Token event should have 'token' field: {event}"
            assert isinstance(event["token"], str), "token should be a string"
        print(f"Received {len(token_events)} token events")
    
    def test_done_event_format(self):
        """Done event should have correct format with full_response."""
        resp = requests.post(f"{BASE_URL}/api/chat/stream",
            json={"message": "Say hi", "instance_id": INSTANCE_ID},
            stream=True,
            timeout=60
        )
        assert resp.status_code == 200
        
        done_data = None
        current_event = None
        
        for line in resp.iter_lines(decode_unicode=True):
            if line.startswith("event: "):
                current_event = line[7:].strip()
            elif line.startswith("data: ") and current_event == "done":
                try:
                    done_data = json.loads(line[6:])
                except json.JSONDecodeError:
                    pass
        
        assert done_data is not None, "Should receive done event"
        assert "full_response" in done_data, "Done event should contain full_response"
        assert isinstance(done_data["full_response"], str), "full_response should be a string"
        print(f"Done event format correct, response length: {len(done_data['full_response'])}")


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(auth_token):
    """Cleanup test API keys after tests complete."""
    yield
    if auth_token:
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Instance-ID": INSTANCE_ID
        }
        # List and delete test keys
        resp = requests.get(f"{BASE_URL}/api/admin/api-keys", headers=headers)
        if resp.status_code == 200:
            keys = resp.json()
            for key in keys:
                if key.get("label") == "TEST_streaming_key":
                    requests.delete(f"{BASE_URL}/api/admin/api-keys/{key['id']}", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
