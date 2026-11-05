"""
API Intelligence Diagnostics Tests
Tests for the Universal API Intelligence Diagnostics & Verification System.
Covers: instance summary, passive scan, discovery test, execution test, unified test, history.
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_USERNAME = "administrator"
ADMIN_PASSWORD = "Admin@123"


class TestDiagnosticsSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in login response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def instance_id(self, auth_token):
        """Get the first instance ID"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/instances", headers=headers)
        assert response.status_code == 200, f"Failed to get instances: {response.text}"
        instances = response.json()
        assert len(instances) > 0, "No instances found"
        return instances[0]["id"]
    
    @pytest.fixture(scope="class")
    def integration_id(self, auth_token, instance_id):
        """Get the first integration ID"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Instance-ID": instance_id
        }
        response = requests.get(f"{BASE_URL}/api/integrations", headers=headers)
        assert response.status_code == 200, f"Failed to get integrations: {response.text}"
        integrations = response.json()
        assert len(integrations) > 0, "No integrations found"
        return integrations[0]["id"]
    
    @pytest.fixture(scope="class")
    def api_client(self, auth_token, instance_id):
        """Create authenticated session with instance header"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {auth_token}",
            "X-Instance-ID": instance_id,
            "Content-Type": "application/json"
        })
        return session


class TestInstanceSummary(TestDiagnosticsSetup):
    """Tests for GET /api/diagnostics/instance-summary"""
    
    def test_instance_summary_requires_auth(self):
        """Instance summary requires authentication"""
        response = requests.get(f"{BASE_URL}/api/diagnostics/instance-summary")
        assert response.status_code == 401, "Should require auth"
        print("PASS: Instance summary requires authentication")
    
    def test_instance_summary_requires_instance_id(self, auth_token):
        """Instance summary requires X-Instance-ID header"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/diagnostics/instance-summary", headers=headers)
        assert response.status_code in [400, 422], f"Should require instance ID, got {response.status_code}"
        print("PASS: Instance summary requires X-Instance-ID header")
    
    def test_instance_summary_returns_data(self, api_client):
        """Instance summary returns expected structure"""
        response = api_client.get(f"{BASE_URL}/api/diagnostics/instance-summary")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "instance_id" in data, "Missing instance_id"
        assert "knowledge_base" in data, "Missing knowledge_base"
        assert "integrations" in data, "Missing integrations"
        assert "endpoints" in data, "Missing endpoints"
        assert "documentation_coverage_pct" in data, "Missing documentation_coverage_pct"
        assert "llm_provider" in data, "Missing llm_provider"
        
        # Verify knowledge_base structure
        assert "active_sources" in data["knowledge_base"], "Missing active_sources in knowledge_base"
        
        # Verify integrations structure
        assert "total" in data["integrations"], "Missing total in integrations"
        assert "enabled" in data["integrations"], "Missing enabled in integrations"
        assert "details" in data["integrations"], "Missing details in integrations"
        
        # Verify endpoints structure
        assert "total" in data["endpoints"], "Missing total in endpoints"
        assert "enabled" in data["endpoints"], "Missing enabled in endpoints"
        
        print(f"PASS: Instance summary returned - KB sources: {data['knowledge_base']['active_sources']}, "
              f"Integrations: {data['integrations']['enabled']}/{data['integrations']['total']}, "
              f"Endpoints: {data['endpoints']['enabled']}/{data['endpoints']['total']}, "
              f"Doc coverage: {data['documentation_coverage_pct']}%, "
              f"LLM: {data['llm_provider']}")


class TestPassiveScan(TestDiagnosticsSetup):
    """Tests for GET /api/integrations/{id}/diagnostics/scan"""
    
    def test_passive_scan_requires_auth(self, integration_id):
        """Passive scan requires authentication"""
        response = requests.get(f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/scan")
        assert response.status_code == 401, "Should require auth"
        print("PASS: Passive scan requires authentication")
    
    def test_passive_scan_requires_instance_id(self, auth_token, integration_id):
        """Passive scan requires X-Instance-ID header"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/scan", headers=headers)
        assert response.status_code in [400, 422], f"Should require instance ID, got {response.status_code}"
        print("PASS: Passive scan requires X-Instance-ID header")
    
    def test_passive_scan_returns_coverage_metrics(self, api_client, integration_id):
        """Passive scan returns documentation coverage metrics"""
        response = api_client.get(f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/scan")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify basic structure
        assert "total_endpoints" in data, "Missing total_endpoints"
        assert "enabled_endpoints" in data, "Missing enabled_endpoints"
        assert "overall_score" in data, "Missing overall_score"
        assert "metrics" in data, "Missing metrics"
        assert "diagnostic_id" in data, "Missing diagnostic_id"
        assert "status" in data, "Missing status"
        assert "duration_ms" in data, "Missing duration_ms"
        
        # Verify metrics structure
        metrics = data["metrics"]
        expected_metrics = [
            "response_schema_coverage",
            "field_description_coverage",
            "parameter_documentation",
            "endpoint_description_coverage",
            "response_example_coverage",
            "error_documentation_coverage"
        ]
        for metric in expected_metrics:
            assert metric in metrics, f"Missing metric: {metric}"
            assert "covered" in metrics[metric], f"Missing 'covered' in {metric}"
            assert "total" in metrics[metric], f"Missing 'total' in {metric}"
            assert "percentage" in metrics[metric], f"Missing 'percentage' in {metric}"
        
        print(f"PASS: Passive scan completed - {data['total_endpoints']} endpoints, "
              f"overall score: {data['overall_score']}%, status: {data['status']}, "
              f"duration: {data['duration_ms']}ms")
    
    def test_passive_scan_is_free(self, api_client, integration_id):
        """Passive scan should be instant (no API/LLM calls)"""
        start = time.time()
        response = api_client.get(f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/scan")
        duration = time.time() - start
        
        assert response.status_code == 200
        # Should complete in under 2 seconds (no external calls)
        assert duration < 2.0, f"Passive scan took too long: {duration}s (should be instant)"
        print(f"PASS: Passive scan is fast ({duration:.2f}s) - no API/LLM calls")


class TestDiscoveryTest(TestDiagnosticsSetup):
    """Tests for POST /api/integrations/{id}/diagnostics/discovery"""
    
    def test_discovery_requires_auth(self, integration_id):
        """Discovery test requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/discovery",
            json={"question": "test"}
        )
        assert response.status_code == 401, "Should require auth"
        print("PASS: Discovery test requires authentication")
    
    def test_discovery_requires_question(self, api_client, integration_id):
        """Discovery test requires a question"""
        response = api_client.post(
            f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/discovery",
            json={}
        )
        assert response.status_code == 422, f"Should require question, got {response.status_code}"
        print("PASS: Discovery test requires question field")
    
    def test_discovery_returns_endpoint_selection(self, api_client, integration_id):
        """Discovery test returns LLM endpoint selection results"""
        response = api_client.post(
            f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/discovery",
            json={
                "question": "What is the latest block on the blockchain?"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "test" in data and data["test"] == "discovery", "Wrong test type"
        assert "status" in data, "Missing status"
        assert "question" in data, "Missing question"
        assert "diagnostic_id" in data, "Missing diagnostic_id"
        assert "duration_ms" in data, "Missing duration_ms"
        
        # If action is call_api, verify selected endpoints
        if data.get("action") == "call_api":
            assert "selected_endpoints" in data, "Missing selected_endpoints"
            assert "all_permissions_valid" in data, "Missing all_permissions_valid"
            for ep in data.get("selected_endpoints", []):
                assert "endpoint_id" in ep, "Missing endpoint_id in selected endpoint"
                assert "found" in ep, "Missing found in selected endpoint"
                assert "enabled" in ep, "Missing enabled in selected endpoint"
                assert "executable" in ep, "Missing executable in selected endpoint"
        
        print(f"PASS: Discovery test completed - action: {data.get('action')}, "
              f"status: {data['status']}, duration: {data['duration_ms']}ms")


class TestExecutionTest(TestDiagnosticsSetup):
    """Tests for POST /api/integrations/{id}/diagnostics/execution"""
    
    @pytest.fixture(scope="class")
    def executable_endpoint_id(self, api_client, integration_id):
        """Get an executable endpoint without path params (like blocks/latest)"""
        response = api_client.get(f"{BASE_URL}/api/integrations/{integration_id}/endpoints")
        assert response.status_code == 200
        endpoints = response.json().get("endpoints", [])
        
        # Find a GET endpoint without path params that is enabled and executable
        for ep in endpoints:
            if (ep.get("enabled") and ep.get("executable") and 
                ep.get("method") == "GET" and "{" not in ep.get("path", "")):
                return ep["id"]
        
        # If no simple endpoint found, return first enabled executable
        for ep in endpoints:
            if ep.get("enabled") and ep.get("executable"):
                return ep["id"]
        
        pytest.skip("No executable endpoints found")
    
    def test_execution_requires_auth(self, integration_id):
        """Execution test requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/execution",
            json={"endpoint_id": "test"}
        )
        assert response.status_code == 401, "Should require auth"
        print("PASS: Execution test requires authentication")
    
    def test_execution_requires_endpoint_id(self, api_client, integration_id):
        """Execution test requires endpoint_id"""
        response = api_client.post(
            f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/execution",
            json={}
        )
        assert response.status_code == 422, f"Should require endpoint_id, got {response.status_code}"
        print("PASS: Execution test requires endpoint_id field")
    
    def test_execution_returns_schema_validation(self, api_client, integration_id, executable_endpoint_id):
        """Execution test returns response with schema validation"""
        response = api_client.post(
            f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/execution",
            json={
                "endpoint_id": executable_endpoint_id,
                "parameters": {}
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "test" in data and data["test"] == "execution", "Wrong test type"
        assert "status" in data, "Missing status"
        assert "endpoint" in data, "Missing endpoint"
        assert "http_status" in data, "Missing http_status"
        assert "diagnostic_id" in data, "Missing diagnostic_id"
        assert "duration_ms" in data, "Missing duration_ms"
        
        # Verify endpoint info
        ep = data["endpoint"]
        assert "id" in ep, "Missing endpoint id"
        assert "method" in ep, "Missing endpoint method"
        assert "path" in ep, "Missing endpoint path"
        
        # If successful, verify schema validation
        if data["status"] == "pass" and data.get("schema_validation"):
            sv = data["schema_validation"]
            assert "valid" in sv, "Missing valid in schema_validation"
            assert "field_results" in sv, "Missing field_results in schema_validation"
            assert "fields_found" in sv, "Missing fields_found"
            assert "fields_expected" in sv, "Missing fields_expected"
        
        print(f"PASS: Execution test completed - HTTP {data['http_status']}, "
              f"status: {data['status']}, duration: {data['duration_ms']}ms")


class TestDiagnosticHistory(TestDiagnosticsSetup):
    """Tests for GET /api/integrations/{id}/diagnostics/history"""
    
    def test_history_requires_auth(self, integration_id):
        """History requires authentication"""
        response = requests.get(f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/history")
        assert response.status_code == 401, "Should require auth"
        print("PASS: History requires authentication")
    
    def test_history_returns_past_runs(self, api_client, integration_id):
        """History returns past diagnostic runs"""
        response = api_client.get(f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/history")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "history" in data, "Missing history array"
        
        # If there are history entries, verify structure
        if len(data["history"]) > 0:
            entry = data["history"][0]
            assert "id" in entry, "Missing id in history entry"
            assert "diagnostic_type" in entry, "Missing diagnostic_type"
            assert "status" in entry, "Missing status"
            assert "duration_ms" in entry, "Missing duration_ms"
            assert "timestamp" in entry, "Missing timestamp"
        
        print(f"PASS: History returned {len(data['history'])} entries")
    
    def test_history_filter_by_type(self, api_client, integration_id):
        """History can be filtered by diagnostic type"""
        response = api_client.get(
            f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/history",
            params={"diagnostic_type": "passive_scan"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # All entries should be passive_scan type
        for entry in data.get("history", []):
            assert entry["diagnostic_type"] == "passive_scan", f"Wrong type: {entry['diagnostic_type']}"
        
        print(f"PASS: History filter by type works - {len(data['history'])} passive_scan entries")


class TestBotInstanceIsolation(TestDiagnosticsSetup):
    """Tests for bot instance isolation"""
    
    def test_diagnostics_isolated_by_instance(self, auth_token, integration_id):
        """Diagnostics only access endpoints belonging to the requesting instance"""
        # Try with a fake instance ID
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "X-Instance-ID": "00000000-0000-0000-0000-000000000000"
        }
        response = requests.get(
            f"{BASE_URL}/api/integrations/{integration_id}/diagnostics/scan",
            headers=headers
        )
        # Should fail because integration doesn't belong to this instance
        assert response.status_code in [403, 404], f"Should deny access, got {response.status_code}"
        print("PASS: Diagnostics are isolated by instance")


class TestIntegrationNotFound(TestDiagnosticsSetup):
    """Tests for non-existent integration handling"""
    
    def test_scan_nonexistent_integration(self, api_client):
        """Scan returns 404 for non-existent integration"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = api_client.get(f"{BASE_URL}/api/integrations/{fake_id}/diagnostics/scan")
        assert response.status_code == 404, f"Should return 404, got {response.status_code}"
        print("PASS: Scan returns 404 for non-existent integration")
    
    def test_discovery_nonexistent_integration(self, api_client):
        """Discovery returns 404 for non-existent integration"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = api_client.post(
            f"{BASE_URL}/api/integrations/{fake_id}/diagnostics/discovery",
            json={"question": "test"}
        )
        assert response.status_code == 404, f"Should return 404, got {response.status_code}"
        print("PASS: Discovery returns 404 for non-existent integration")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
