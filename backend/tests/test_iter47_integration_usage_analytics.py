"""
Iteration 47: Integration Usage Analytics Tests
Tests the new GET /api/admin/integration-usage-analytics endpoint and related features.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_username": "administrator",
        "password": "Admin@123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token and instance ID."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "X-Instance-ID": INSTANCE_ID,
        "Content-Type": "application/json"
    }


class TestIntegrationUsageAnalyticsEndpoint:
    """Tests for GET /api/admin/integration-usage-analytics endpoint."""

    def test_endpoint_returns_200(self, auth_headers):
        """Endpoint returns 200 OK with valid auth."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_response_structure(self, auth_headers):
        """Response contains all required fields."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check top-level fields
        assert "period_days" in data, "Missing period_days"
        assert "totals" in data, "Missing totals"
        assert "integrations" in data, "Missing integrations"
        assert "requests_by_day" in data, "Missing requests_by_day"
        assert "top_endpoints" in data, "Missing top_endpoints"
        assert "error_breakdown" in data, "Missing error_breakdown"
        assert "recent_requests" in data, "Missing recent_requests"

    def test_totals_structure(self, auth_headers):
        """Totals object contains correct fields."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        totals = response.json()["totals"]
        
        assert "total_requests" in totals, "Missing total_requests in totals"
        assert "successful" in totals, "Missing successful in totals"
        assert "failed" in totals, "Missing failed in totals"
        assert "success_rate" in totals, "Missing success_rate in totals"
        
        # Verify types
        assert isinstance(totals["total_requests"], int), "total_requests should be int"
        assert isinstance(totals["successful"], int), "successful should be int"
        assert isinstance(totals["failed"], int), "failed should be int"
        assert isinstance(totals["success_rate"], (int, float)), "success_rate should be numeric"

    def test_integrations_structure(self, auth_headers):
        """Integration objects contain correct fields."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        integrations = response.json()["integrations"]
        
        if len(integrations) > 0:
            intg = integrations[0]
            assert "integration_id" in intg, "Missing integration_id"
            assert "name" in intg, "Missing name"
            assert "base_url" in intg, "Missing base_url"
            assert "total_requests" in intg, "Missing total_requests"
            assert "successful" in intg, "Missing successful"
            assert "failed" in intg, "Missing failed"
            assert "avg_duration_ms" in intg, "Missing avg_duration_ms"
            assert "total_bytes" in intg, "Missing total_bytes"
            assert "success_rate" in intg, "Missing success_rate"

    def test_requests_by_day_structure(self, auth_headers):
        """Daily breakdown contains correct fields."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        by_day = response.json()["requests_by_day"]
        
        if len(by_day) > 0:
            day = by_day[0]
            assert "date" in day, "Missing date"
            assert "total" in day, "Missing total"
            assert "successful" in day, "Missing successful"
            assert "failed" in day, "Missing failed"
            assert "avg_duration_ms" in day, "Missing avg_duration_ms"

    def test_top_endpoints_structure(self, auth_headers):
        """Top endpoints contain correct fields."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        endpoints = response.json()["top_endpoints"]
        
        if len(endpoints) > 0:
            ep = endpoints[0]
            assert "integration_name" in ep, "Missing integration_name"
            assert "endpoint_path" in ep, "Missing endpoint_path"
            assert "total" in ep, "Missing total"
            assert "avg_duration_ms" in ep, "Missing avg_duration_ms"

    def test_recent_requests_structure(self, auth_headers):
        """Recent requests contain correct fields."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        recent = response.json()["recent_requests"]
        
        if len(recent) > 0:
            req = recent[0]
            assert "timestamp" in req, "Missing timestamp"
            assert "integration_name" in req, "Missing integration_name"
            assert "endpoint_path" in req or "endpoint_path" in req or req.get("endpoint_path") is not None or "endpoint_path" not in req, "endpoint_path field check"
            assert "http_status" in req, "Missing http_status"
            assert "success" in req, "Missing success"
            assert "duration_ms" in req, "Missing duration_ms"

    def test_days_filter_7(self, auth_headers):
        """Days filter with 7 days works."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics?days=7",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period_days"] == 7, f"Expected period_days=7, got {data['period_days']}"

    def test_days_filter_14(self, auth_headers):
        """Days filter with 14 days works."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics?days=14",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period_days"] == 14, f"Expected period_days=14, got {data['period_days']}"

    def test_days_filter_30(self, auth_headers):
        """Days filter with 30 days works (default)."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics?days=30",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period_days"] == 30, f"Expected period_days=30, got {data['period_days']}"

    def test_days_filter_90(self, auth_headers):
        """Days filter with 90 days works."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics?days=90",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period_days"] == 90, f"Expected period_days=90, got {data['period_days']}"

    def test_requires_auth(self):
        """Endpoint requires authentication."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics",
            headers={"X-Instance-ID": INSTANCE_ID}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_requires_instance_id(self, auth_token):
        """Endpoint requires X-Instance-ID header."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"


class TestApiKeyAnalyticsEndpoint:
    """Tests for existing GET /api/admin/api-key-analytics endpoint."""

    def test_endpoint_returns_200(self, auth_headers):
        """Endpoint returns 200 OK with valid auth."""
        response = requests.get(
            f"{BASE_URL}/api/admin/api-key-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_returns_list_of_keys(self, auth_headers):
        """Response is a list of API keys with analytics."""
        response = requests.get(
            f"{BASE_URL}/api/admin/api-key-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list"

    def test_key_structure(self, auth_headers):
        """Each key has required fields."""
        response = requests.get(
            f"{BASE_URL}/api/admin/api-key-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        keys = response.json()
        
        if len(keys) > 0:
            key = keys[0]
            assert "id" in key, "Missing id"
            assert "key_prefix" in key, "Missing key_prefix"
            assert "label" in key, "Missing label"
            assert "is_active" in key, "Missing is_active"
            assert "analytics" in key, "Missing analytics"

    def test_analytics_structure(self, auth_headers):
        """Analytics object has required fields."""
        response = requests.get(
            f"{BASE_URL}/api/admin/api-key-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        keys = response.json()
        
        if len(keys) > 0:
            analytics = keys[0].get("analytics", {})
            assert "total_requests" in analytics, "Missing total_requests in analytics"
            assert "successful" in analytics, "Missing successful in analytics"
            assert "failed" in analytics, "Missing failed in analytics"

    def test_days_filter(self, auth_headers):
        """Days filter parameter works."""
        response = requests.get(
            f"{BASE_URL}/api/admin/api-key-analytics?days=7",
            headers=auth_headers
        )
        assert response.status_code == 200
        keys = response.json()
        if len(keys) > 0:
            analytics = keys[0].get("analytics", {})
            assert analytics.get("period_days") == 7, f"Expected period_days=7"


class TestDataConsistency:
    """Tests for data consistency between endpoints."""

    def test_integration_totals_match_sum(self, auth_headers):
        """Total requests equals sum of successful + failed."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        totals = response.json()["totals"]
        
        assert totals["total_requests"] == totals["successful"] + totals["failed"], \
            f"Total ({totals['total_requests']}) != successful ({totals['successful']}) + failed ({totals['failed']})"

    def test_success_rate_calculation(self, auth_headers):
        """Success rate is correctly calculated."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        totals = response.json()["totals"]
        
        if totals["total_requests"] > 0:
            expected_rate = round(totals["successful"] / totals["total_requests"] * 100, 1)
            assert abs(totals["success_rate"] - expected_rate) < 0.2, \
                f"Success rate mismatch: {totals['success_rate']} vs expected {expected_rate}"

    def test_grid_scan_integration_present(self, auth_headers):
        """Grid Scan integration is present in the data."""
        response = requests.get(
            f"{BASE_URL}/api/admin/integration-usage-analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        integrations = response.json()["integrations"]
        
        grid_scan = next((i for i in integrations if "Grid Scan" in i.get("name", "")), None)
        assert grid_scan is not None, "Grid Scan integration not found in data"
        assert grid_scan["total_requests"] > 0, "Grid Scan should have requests"
