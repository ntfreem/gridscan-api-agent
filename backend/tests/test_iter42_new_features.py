"""
Iteration 42 - Testing new features:
1. Conversation Search - GET /api/conversations?search=<query>
2. Conversations Count - GET /api/conversations/count
3. Knowledge Gate Slider - PUT /api/admin/bot-config with knowledge_gate_pct
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

class TestConversationSearch:
    """Test conversation search functionality via regex backend search."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token."""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "X-Instance-ID": INSTANCE_ID
        })
    
    def test_search_conversations_with_match(self):
        """GET /api/conversations?search=France returns only conversations containing 'France' in messages."""
        # First, get all conversations to see what we have
        all_resp = self.session.get(f"{BASE_URL}/api/conversations?limit=50")
        assert all_resp.status_code == 200
        all_data = all_resp.json()
        all_total = all_data.get("total", 0)
        print(f"Total conversations without search: {all_total}")
        
        # Now search for 'France'
        search_resp = self.session.get(f"{BASE_URL}/api/conversations?search=France&limit=50")
        assert search_resp.status_code == 200
        search_data = search_resp.json()
        search_total = search_data.get("total", 0)
        conversations = search_data.get("conversations", [])
        
        print(f"Search results for 'France': {search_total} matches")
        
        # Verify that search results are fewer than or equal to total
        assert search_total <= all_total, "Search results should be <= total conversations"
        
        # Verify each returned conversation contains 'France' in messages
        for conv in conversations:
            messages = conv.get("messages", [])
            has_france = any("france" in (m.get("content", "") or "").lower() for m in messages)
            assert has_france, f"Conversation {conv.get('session_id')} should contain 'France' in messages"
        
        print(f"PASS: All {len(conversations)} returned conversations contain 'France'")
    
    def test_search_conversations_no_match(self):
        """GET /api/conversations?search=nonexistent returns 0 results."""
        search_resp = self.session.get(f"{BASE_URL}/api/conversations?search=xyznonexistent123abc&limit=50")
        assert search_resp.status_code == 200
        search_data = search_resp.json()
        search_total = search_data.get("total", 0)
        conversations = search_data.get("conversations", [])
        
        print(f"Search results for 'xyznonexistent123abc': {search_total} matches")
        
        assert search_total == 0, f"Expected 0 results for nonexistent search, got {search_total}"
        assert len(conversations) == 0, f"Expected empty list, got {len(conversations)} conversations"
        
        print("PASS: Nonexistent search returns 0 results")
    
    def test_search_conversations_case_insensitive(self):
        """Search should be case-insensitive."""
        # Search with lowercase
        lower_resp = self.session.get(f"{BASE_URL}/api/conversations?search=hello&limit=50")
        assert lower_resp.status_code == 200
        lower_total = lower_resp.json().get("total", 0)
        
        # Search with uppercase
        upper_resp = self.session.get(f"{BASE_URL}/api/conversations?search=HELLO&limit=50")
        assert upper_resp.status_code == 200
        upper_total = upper_resp.json().get("total", 0)
        
        # Search with mixed case
        mixed_resp = self.session.get(f"{BASE_URL}/api/conversations?search=Hello&limit=50")
        assert mixed_resp.status_code == 200
        mixed_total = mixed_resp.json().get("total", 0)
        
        print(f"Search 'hello': {lower_total}, 'HELLO': {upper_total}, 'Hello': {mixed_total}")
        
        # All should return the same count (case-insensitive)
        assert lower_total == upper_total == mixed_total, "Search should be case-insensitive"
        
        print("PASS: Search is case-insensitive")


class TestConversationsCount:
    """Test the lightweight count endpoint for auto-refresh polling."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token."""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "X-Instance-ID": INSTANCE_ID
        })
    
    def test_conversations_count_endpoint(self):
        """GET /api/conversations/count returns the total count without full conversation data."""
        count_resp = self.session.get(f"{BASE_URL}/api/conversations/count")
        assert count_resp.status_code == 200
        count_data = count_resp.json()
        
        # Should have 'total' field
        assert "total" in count_data, "Response should contain 'total' field"
        total = count_data.get("total")
        assert isinstance(total, int), f"Total should be an integer, got {type(total)}"
        assert total >= 0, f"Total should be non-negative, got {total}"
        
        print(f"Conversations count: {total}")
        
        # Verify it matches the full conversations endpoint
        full_resp = self.session.get(f"{BASE_URL}/api/conversations?limit=1")
        assert full_resp.status_code == 200
        full_total = full_resp.json().get("total", 0)
        
        assert total == full_total, f"Count endpoint ({total}) should match full endpoint ({full_total})"
        
        print(f"PASS: Count endpoint returns {total}, matches full endpoint")
    
    def test_conversations_count_lightweight(self):
        """Count endpoint should NOT return conversation data."""
        count_resp = self.session.get(f"{BASE_URL}/api/conversations/count")
        assert count_resp.status_code == 200
        count_data = count_resp.json()
        
        # Should NOT have 'conversations' field
        assert "conversations" not in count_data, "Count endpoint should not return conversations array"
        
        # Should only have 'total'
        assert set(count_data.keys()) == {"total"}, f"Expected only 'total' key, got {count_data.keys()}"
        
        print("PASS: Count endpoint is lightweight (only returns total)")


class TestKnowledgeGateSlider:
    """Test the knowledge gate percentage slider (0-100%)."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token."""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": "administrator",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "X-Instance-ID": INSTANCE_ID
        })
        # Store original config to restore later
        self.original_config = self.session.get(f"{BASE_URL}/api/admin/bot-config").json()
    
    def teardown_method(self, method):
        """Restore original knowledge_gate_pct after each test."""
        if hasattr(self, 'original_config') and self.original_config:
            original_pct = self.original_config.get("knowledge_gate_pct", 50)
            self.session.put(f"{BASE_URL}/api/admin/bot-config", json={
                "knowledge_gate_pct": original_pct
            })
    
    def test_knowledge_gate_pct_0_strict(self):
        """PUT /api/admin/bot-config with knowledge_gate_pct=0 saves and returns pct=0, gate=strict."""
        resp = self.session.put(f"{BASE_URL}/api/admin/bot-config", json={
            "knowledge_gate_pct": 0
        })
        assert resp.status_code == 200, f"Failed to update config: {resp.text}"
        data = resp.json()
        
        assert data.get("knowledge_gate_pct") == 0, f"Expected pct=0, got {data.get('knowledge_gate_pct')}"
        assert data.get("knowledge_gate") == "strict", f"Expected gate=strict, got {data.get('knowledge_gate')}"
        
        print("PASS: knowledge_gate_pct=0 → pct=0, gate=strict")
    
    def test_knowledge_gate_pct_50_balanced(self):
        """PUT /api/admin/bot-config with knowledge_gate_pct=50 saves and returns pct=50, gate=flexible."""
        resp = self.session.put(f"{BASE_URL}/api/admin/bot-config", json={
            "knowledge_gate_pct": 50
        })
        assert resp.status_code == 200, f"Failed to update config: {resp.text}"
        data = resp.json()
        
        assert data.get("knowledge_gate_pct") == 50, f"Expected pct=50, got {data.get('knowledge_gate_pct')}"
        # 50% is > 20, so legacy gate should be "flexible"
        assert data.get("knowledge_gate") == "flexible", f"Expected gate=flexible, got {data.get('knowledge_gate')}"
        
        print("PASS: knowledge_gate_pct=50 → pct=50, gate=flexible")
    
    def test_knowledge_gate_pct_100_fully_open(self):
        """PUT /api/admin/bot-config with knowledge_gate_pct=100 saves and returns pct=100, gate=flexible."""
        resp = self.session.put(f"{BASE_URL}/api/admin/bot-config", json={
            "knowledge_gate_pct": 100
        })
        assert resp.status_code == 200, f"Failed to update config: {resp.text}"
        data = resp.json()
        
        assert data.get("knowledge_gate_pct") == 100, f"Expected pct=100, got {data.get('knowledge_gate_pct')}"
        assert data.get("knowledge_gate") == "flexible", f"Expected gate=flexible, got {data.get('knowledge_gate')}"
        
        print("PASS: knowledge_gate_pct=100 → pct=100, gate=flexible")
    
    def test_knowledge_gate_pct_20_strict_boundary(self):
        """PUT /api/admin/bot-config with knowledge_gate_pct=20 should be strict (boundary)."""
        resp = self.session.put(f"{BASE_URL}/api/admin/bot-config", json={
            "knowledge_gate_pct": 20
        })
        assert resp.status_code == 200, f"Failed to update config: {resp.text}"
        data = resp.json()
        
        assert data.get("knowledge_gate_pct") == 20, f"Expected pct=20, got {data.get('knowledge_gate_pct')}"
        # 20% is <= 20, so legacy gate should be "strict"
        assert data.get("knowledge_gate") == "strict", f"Expected gate=strict at 20%, got {data.get('knowledge_gate')}"
        
        print("PASS: knowledge_gate_pct=20 → pct=20, gate=strict (boundary)")
    
    def test_knowledge_gate_pct_25_flexible_boundary(self):
        """PUT /api/admin/bot-config with knowledge_gate_pct=25 should be flexible (just above boundary)."""
        resp = self.session.put(f"{BASE_URL}/api/admin/bot-config", json={
            "knowledge_gate_pct": 25
        })
        assert resp.status_code == 200, f"Failed to update config: {resp.text}"
        data = resp.json()
        
        assert data.get("knowledge_gate_pct") == 25, f"Expected pct=25, got {data.get('knowledge_gate_pct')}"
        # 25% is > 20, so legacy gate should be "flexible"
        assert data.get("knowledge_gate") == "flexible", f"Expected gate=flexible at 25%, got {data.get('knowledge_gate')}"
        
        print("PASS: knowledge_gate_pct=25 → pct=25, gate=flexible (just above boundary)")
    
    def test_knowledge_gate_pct_invalid_negative(self):
        """PUT /api/admin/bot-config with knowledge_gate_pct=-1 should fail."""
        resp = self.session.put(f"{BASE_URL}/api/admin/bot-config", json={
            "knowledge_gate_pct": -1
        })
        assert resp.status_code == 422, f"Expected 422 for negative pct, got {resp.status_code}"
        
        print("PASS: knowledge_gate_pct=-1 returns 422")
    
    def test_knowledge_gate_pct_invalid_over_100(self):
        """PUT /api/admin/bot-config with knowledge_gate_pct=101 should fail."""
        resp = self.session.put(f"{BASE_URL}/api/admin/bot-config", json={
            "knowledge_gate_pct": 101
        })
        assert resp.status_code == 422, f"Expected 422 for pct>100, got {resp.status_code}"
        
        print("PASS: knowledge_gate_pct=101 returns 422")
    
    def test_knowledge_gate_pct_persists(self):
        """Verify knowledge_gate_pct persists after saving and reloading."""
        # Set to 75%
        set_resp = self.session.put(f"{BASE_URL}/api/admin/bot-config", json={
            "knowledge_gate_pct": 75
        })
        assert set_resp.status_code == 200
        
        # Reload config
        get_resp = self.session.get(f"{BASE_URL}/api/admin/bot-config")
        assert get_resp.status_code == 200
        data = get_resp.json()
        
        assert data.get("knowledge_gate_pct") == 75, f"Expected persisted pct=75, got {data.get('knowledge_gate_pct')}"
        
        print("PASS: knowledge_gate_pct=75 persists after reload")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
