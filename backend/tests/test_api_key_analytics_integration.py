"""
Test API Key Analytics with Integration Usage - Iteration 50
Tests the enhanced API Key Usage analytics showing external API integration usage
alongside LLM usage per API key.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"

@pytest.fixture(scope="module")
def auth_headers():
    """Login and get auth headers with instance ID."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": "administrator",
        "password": "Admin@123"
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json().get("token")
    return {
        "Authorization": f"Bearer {token}",
        "X-Instance-ID": INSTANCE_ID,
        "Content-Type": "application/json"
    }


class TestApiKeyAnalyticsList:
    """Test GET /api/admin/api-key-analytics endpoint."""
    
    def test_list_returns_200(self, auth_headers):
        """API key analytics list endpoint returns 200."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics?days=30", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list of keys"
        print(f"PASS: GET /api/admin/api-key-analytics returned {len(data)} keys")
    
    def test_list_contains_analytics_fields(self, auth_headers):
        """Each key in the list has analytics object with required fields."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics?days=30", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        if len(data) == 0:
            pytest.skip("No API keys found in instance")
        
        for key in data:
            assert "id" in key, "Key should have id"
            assert "key_prefix" in key, "Key should have key_prefix"
            assert "analytics" in key, "Key should have analytics object"
            
            analytics = key["analytics"]
            assert "total_requests" in analytics, "Analytics should have total_requests"
            assert "successful" in analytics, "Analytics should have successful"
            assert "failed" in analytics, "Analytics should have failed"
            assert "integration_calls_total" in analytics, "Analytics should have integration_calls_total"
            assert "integration_calls" in analytics, "Analytics should have integration_calls array"
            
            print(f"Key {key['key_prefix']}... - LLM: {analytics['total_requests']}, API: {analytics['integration_calls_total']}")
        
        print(f"PASS: All {len(data)} keys have required analytics fields including integration_calls_total")
    
    def test_integration_calls_structure(self, auth_headers):
        """Integration calls array has correct structure."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics?days=30", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        keys_with_intg = [k for k in data if k.get("analytics", {}).get("integration_calls")]
        
        if not keys_with_intg:
            print("INFO: No keys have integration calls - checking structure on empty array")
            for key in data:
                assert isinstance(key.get("analytics", {}).get("integration_calls", []), list)
            print("PASS: integration_calls is a list (empty)")
            return
        
        for key in keys_with_intg:
            for ic in key["analytics"]["integration_calls"]:
                assert "integration_id" in ic, "Integration call should have integration_id"
                assert "name" in ic, "Integration call should have name"
                assert "count" in ic, "Integration call should have count"
                print(f"  Integration: {ic['name']} - {ic['count']} calls")
        
        print(f"PASS: {len(keys_with_intg)} keys have properly structured integration_calls")
    
    def test_days_filter_works(self, auth_headers):
        """Days filter parameter affects the results."""
        resp_7 = requests.get(f"{BASE_URL}/api/admin/api-key-analytics?days=7", headers=auth_headers)
        resp_90 = requests.get(f"{BASE_URL}/api/admin/api-key-analytics?days=90", headers=auth_headers)
        
        assert resp_7.status_code == 200
        assert resp_90.status_code == 200
        
        data_7 = resp_7.json()
        data_90 = resp_90.json()
        
        # Both should return same number of keys
        assert len(data_7) == len(data_90), "Same keys should be returned regardless of days filter"
        
        # Check period_days is set correctly
        if data_7:
            assert data_7[0]["analytics"]["period_days"] == 7
        if data_90:
            assert data_90[0]["analytics"]["period_days"] == 90
        
        print("PASS: Days filter parameter works correctly")


class TestApiKeyAnalyticsDetail:
    """Test GET /api/admin/api-key-analytics/{key_id} endpoint."""
    
    @pytest.fixture
    def first_key_id(self, auth_headers):
        """Get the first API key ID for detail tests."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics?days=30", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        if not data:
            pytest.skip("No API keys found")
        return data[0]["id"]
    
    def test_detail_returns_200(self, auth_headers, first_key_id):
        """API key analytics detail endpoint returns 200."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics/{first_key_id}?days=30", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS: GET /api/admin/api-key-analytics/{first_key_id} returned 200")
    
    def test_detail_has_summary(self, auth_headers, first_key_id):
        """Detail response has summary with required fields."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics/{first_key_id}?days=30", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        assert "summary" in data, "Response should have summary"
        summary = data["summary"]
        
        required_fields = ["total_requests", "successful", "failed", "success_rate",
                          "total_input_tokens", "total_output_tokens", "avg_duration_ms",
                          "estimated_cost_usd"]
        for field in required_fields:
            assert field in summary, f"Summary should have {field}"
        
        print(f"PASS: Summary has all required fields - {summary['total_requests']} total requests")
    
    def test_detail_has_requests_by_day(self, auth_headers, first_key_id):
        """Detail response has requests_by_day array."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics/{first_key_id}?days=30", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        assert "requests_by_day" in data, "Response should have requests_by_day"
        assert isinstance(data["requests_by_day"], list), "requests_by_day should be a list"
        
        if data["requests_by_day"]:
            day = data["requests_by_day"][0]
            assert "date" in day, "Day entry should have date"
            assert "total" in day, "Day entry should have total"
            assert "successful" in day, "Day entry should have successful"
            assert "failed" in day, "Day entry should have failed"
        
        print(f"PASS: requests_by_day has {len(data['requests_by_day'])} entries")
    
    def test_detail_has_model_breakdown(self, auth_headers, first_key_id):
        """Detail response has model_breakdown array."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics/{first_key_id}?days=30", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        assert "model_breakdown" in data, "Response should have model_breakdown"
        assert isinstance(data["model_breakdown"], list), "model_breakdown should be a list"
        
        if data["model_breakdown"]:
            model = data["model_breakdown"][0]
            assert "model" in model, "Model entry should have model"
            assert "count" in model, "Model entry should have count"
            print(f"  Top model: {model['model']} - {model['count']} requests")
        
        print(f"PASS: model_breakdown has {len(data['model_breakdown'])} entries")
    
    def test_detail_has_integration_usage(self, auth_headers, first_key_id):
        """Detail response has integration_usage object with required fields."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics/{first_key_id}?days=30", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        assert "integration_usage" in data, "Response should have integration_usage"
        intg_usage = data["integration_usage"]
        
        assert "integrations" in intg_usage, "integration_usage should have integrations array"
        assert "total_calls" in intg_usage, "integration_usage should have total_calls"
        assert "requests_by_day" in intg_usage, "integration_usage should have requests_by_day"
        assert "recent_calls" in intg_usage, "integration_usage should have recent_calls"
        
        print(f"PASS: integration_usage has {intg_usage['total_calls']} total calls")
    
    def test_integration_usage_integrations_structure(self, auth_headers, first_key_id):
        """Integration usage integrations array has correct structure."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics/{first_key_id}?days=30", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        intg_usage = data.get("integration_usage", {})
        integrations = intg_usage.get("integrations", [])
        
        if not integrations:
            print("INFO: No integrations in usage data")
            return
        
        for intg in integrations:
            assert "integration_id" in intg, "Integration should have integration_id"
            assert "name" in intg, "Integration should have name"
            assert "total" in intg, "Integration should have total"
            assert "successful" in intg, "Integration should have successful"
            assert "avg_duration_ms" in intg, "Integration should have avg_duration_ms"
            print(f"  Integration: {intg['name']} - {intg['total']} calls, {intg['avg_duration_ms']}ms avg")
        
        print(f"PASS: {len(integrations)} integrations have correct structure")
    
    def test_integration_usage_requests_by_day(self, auth_headers, first_key_id):
        """Integration usage requests_by_day has correct structure."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics/{first_key_id}?days=30", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        intg_usage = data.get("integration_usage", {})
        by_day = intg_usage.get("requests_by_day", [])
        
        if not by_day:
            print("INFO: No integration requests by day data")
            return
        
        for day in by_day:
            assert "date" in day, "Day entry should have date"
            assert "total" in day, "Day entry should have total"
            assert "successful" in day, "Day entry should have successful"
            assert "failed" in day, "Day entry should have failed"
        
        print(f"PASS: integration requests_by_day has {len(by_day)} entries")
    
    def test_integration_usage_recent_calls(self, auth_headers, first_key_id):
        """Integration usage recent_calls has correct structure."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics/{first_key_id}?days=30", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        intg_usage = data.get("integration_usage", {})
        recent = intg_usage.get("recent_calls", [])
        
        if not recent:
            print("INFO: No recent integration calls")
            return
        
        for call in recent[:5]:  # Check first 5
            assert "timestamp" in call, "Call should have timestamp"
            assert "integration_name" in call, "Call should have integration_name"
            assert "http_status" in call, "Call should have http_status"
            assert "success" in call, "Call should have success"
            print(f"  Recent call: {call['integration_name']} - {call.get('endpoint_path', 'N/A')} - HTTP {call['http_status']}")
        
        print(f"PASS: recent_calls has {len(recent)} entries with correct structure")
    
    def test_detail_days_filter(self, auth_headers, first_key_id):
        """Days filter affects detail response."""
        resp_7 = requests.get(f"{BASE_URL}/api/admin/api-key-analytics/{first_key_id}?days=7", headers=auth_headers)
        resp_90 = requests.get(f"{BASE_URL}/api/admin/api-key-analytics/{first_key_id}?days=90", headers=auth_headers)
        
        assert resp_7.status_code == 200
        assert resp_90.status_code == 200
        
        data_7 = resp_7.json()
        data_90 = resp_90.json()
        
        assert data_7["period_days"] == 7
        assert data_90["period_days"] == 90
        
        print("PASS: Days filter works on detail endpoint")
    
    def test_detail_404_for_invalid_key(self, auth_headers):
        """Detail endpoint returns 404 for non-existent key."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics/invalid-key-id-12345?days=30", headers=auth_headers)
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("PASS: 404 returned for invalid key ID")


class TestIntegrationUsageAnalytics:
    """Test GET /api/admin/integration-usage-analytics endpoint."""
    
    def test_endpoint_returns_200(self, auth_headers):
        """Integration usage analytics endpoint returns 200."""
        resp = requests.get(f"{BASE_URL}/api/admin/integration-usage-analytics?days=30", headers=auth_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: GET /api/admin/integration-usage-analytics returned 200")
    
    def test_response_structure(self, auth_headers):
        """Response has required top-level fields."""
        resp = requests.get(f"{BASE_URL}/api/admin/integration-usage-analytics?days=30", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        assert "totals" in data, "Response should have totals"
        assert "integrations" in data, "Response should have integrations"
        assert "requests_by_day" in data, "Response should have requests_by_day"
        
        totals = data["totals"]
        assert "total_requests" in totals, "Totals should have total_requests"
        assert "successful" in totals, "Totals should have successful"
        assert "failed" in totals, "Totals should have failed"
        
        print(f"PASS: Response has correct structure - {totals['total_requests']} total integration calls")


class TestAuthRequired:
    """Test that endpoints require authentication."""
    
    def test_list_requires_auth(self):
        """List endpoint requires authentication."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics?days=30")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("PASS: List endpoint requires auth")
    
    def test_detail_requires_auth(self):
        """Detail endpoint requires authentication."""
        resp = requests.get(f"{BASE_URL}/api/admin/api-key-analytics/some-key-id?days=30")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("PASS: Detail endpoint requires auth")
    
    def test_integration_usage_requires_auth(self):
        """Integration usage endpoint requires authentication."""
        resp = requests.get(f"{BASE_URL}/api/admin/integration-usage-analytics?days=30")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("PASS: Integration usage endpoint requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
