"""
Iteration 46 Tests: Embed.js launcher script and Theme Configurator
- GET /api/embed.js endpoint with theme data-* attributes support
- Pulse animation keyframes in embed.js
- Mobile responsive media query in embed.js
- Theme parameter handling
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
INSTANCE_ID = "88bfae82-2533-4235-968d-b3298fd57073"


class TestEmbedJsEndpoint:
    """Tests for GET /api/embed.js endpoint"""

    def test_embed_js_returns_valid_javascript(self):
        """Test that embed.js endpoint returns valid JavaScript"""
        response = requests.get(
            f"{BASE_URL}/api/embed.js",
            params={"instance": INSTANCE_ID, "mode": "popup"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "application/javascript" in response.headers.get("content-type", ""), \
            f"Expected JavaScript content type, got {response.headers.get('content-type')}"
        
        content = response.text
        assert "(function()" in content, "Should be an IIFE"
        assert "BridgeBot" in content or "bridgebot" in content.lower(), "Should reference BridgeBot"
        print("PASS: embed.js returns valid JavaScript")

    def test_embed_js_contains_data_attribute_reading(self):
        """Test that embed.js reads data-* attributes from script tag"""
        response = requests.get(
            f"{BASE_URL}/api/embed.js",
            params={"instance": INSTANCE_ID, "mode": "popup"}
        )
        assert response.status_code == 200
        content = response.text
        
        # Check for data-* attribute reading logic
        assert 'data-' in content, "Should reference data-* attributes"
        assert 'getAttribute' in content, "Should use getAttribute to read data attributes"
        assert 'scriptEl' in content or 'currentScript' in content, "Should reference script element"
        print("PASS: embed.js contains data-* attribute reading logic")

    def test_embed_js_contains_theme_parameters(self):
        """Test that embed.js handles theme parameters"""
        response = requests.get(
            f"{BASE_URL}/api/embed.js",
            params={"instance": INSTANCE_ID, "mode": "popup"}
        )
        assert response.status_code == 200
        content = response.text
        
        # Check for theme parameter handling
        theme_params = ["accent", "accentLight", "bg", "surface", "panel", "border", "userBubble", "botBubble"]
        found_params = [p for p in theme_params if p in content]
        assert len(found_params) >= 5, f"Should contain theme params, found: {found_params}"
        
        # Check for themeQuery building
        assert "themeQuery" in content or "theme" in content.lower(), "Should build theme query string"
        print(f"PASS: embed.js contains theme parameters: {found_params}")

    def test_embed_js_contains_pulse_animation(self):
        """Test that embed.js contains pulse animation keyframes"""
        response = requests.get(
            f"{BASE_URL}/api/embed.js",
            params={"instance": INSTANCE_ID, "mode": "popup"}
        )
        assert response.status_code == 200
        content = response.text
        
        # Check for pulse animation
        assert "bb-pulse" in content, "Should contain bb-pulse animation name"
        assert "@keyframes" in content, "Should contain @keyframes rule"
        assert "box-shadow" in content, "Pulse animation should use box-shadow"
        print("PASS: embed.js contains pulse animation keyframes")

    def test_embed_js_contains_mobile_responsive_media_query(self):
        """Test that embed.js contains mobile responsive media query"""
        response = requests.get(
            f"{BASE_URL}/api/embed.js",
            params={"instance": INSTANCE_ID, "mode": "popup"}
        )
        assert response.status_code == 200
        content = response.text
        
        # Check for mobile media query
        assert "@media" in content, "Should contain @media rule"
        assert "max-width" in content, "Should have max-width breakpoint"
        assert "480px" in content or "100vw" in content, "Should have mobile breakpoint or full viewport"
        print("PASS: embed.js contains mobile responsive media query")

    def test_embed_js_contains_floating_button(self):
        """Test that embed.js creates a floating chat button"""
        response = requests.get(
            f"{BASE_URL}/api/embed.js",
            params={"instance": INSTANCE_ID, "mode": "popup"}
        )
        assert response.status_code == 200
        content = response.text
        
        # Check for floating button creation
        assert "position:fixed" in content, "Should have fixed positioning"
        assert "bottom:" in content, "Should position at bottom"
        assert "border-radius:50%" in content or "borderRadius" in content, "Should be circular button"
        assert "z-index" in content, "Should have z-index for layering"
        print("PASS: embed.js creates floating chat button")

    def test_embed_js_popup_mode(self):
        """Test embed.js in popup mode"""
        response = requests.get(
            f"{BASE_URL}/api/embed.js",
            params={"instance": INSTANCE_ID, "mode": "popup"}
        )
        assert response.status_code == 200
        content = response.text
        
        # Check for popup-specific elements
        assert "bb-embed-trigger" in content, "Should have trigger button class"
        assert "bb-embed-panel" in content, "Should have panel class"
        assert "bridgebot-popup-trigger" in content, "Should have popup trigger testid"
        print("PASS: embed.js popup mode contains required elements")

    def test_embed_js_inline_mode_handling(self):
        """Test that embed.js handles inline mode"""
        response = requests.get(
            f"{BASE_URL}/api/embed.js",
            params={"instance": INSTANCE_ID, "mode": "inline"}
        )
        assert response.status_code == 200
        content = response.text
        
        # Check for inline mode handling
        assert "inline" in content, "Should handle inline mode"
        assert "bridgebot-container" in content, "Should look for container element"
        print("PASS: embed.js handles inline mode")

    def test_embed_js_fullpage_mode_handling(self):
        """Test that embed.js handles fullpage mode"""
        response = requests.get(
            f"{BASE_URL}/api/embed.js",
            params={"instance": INSTANCE_ID, "mode": "fullpage"}
        )
        assert response.status_code == 200
        content = response.text
        
        # Check for fullpage mode handling
        assert "fullpage" in content, "Should handle fullpage mode"
        assert "100%" in content, "Should use full viewport"
        print("PASS: embed.js handles fullpage mode")

    def test_embed_js_widget_url_construction(self):
        """Test that embed.js constructs widget URL correctly"""
        response = requests.get(
            f"{BASE_URL}/api/embed.js",
            params={"instance": INSTANCE_ID, "mode": "popup"}
        )
        assert response.status_code == 200
        content = response.text
        
        # Check for widget URL construction
        assert "/widget?" in content, "Should construct widget URL"
        assert "instance=" in content, "Should include instance parameter"
        assert "mode=" in content, "Should include mode parameter"
        print("PASS: embed.js constructs widget URL correctly")


class TestEmbedConfig:
    """Tests for embed configuration endpoints"""

    def test_embed_config_endpoint(self):
        """Test GET /api/embed/config/{instance_id}"""
        response = requests.get(f"{BASE_URL}/api/embed/config/{INSTANCE_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Should return config object (may be empty or have custom_css_url)
        assert isinstance(data, dict), "Should return a dict"
        print(f"PASS: embed config endpoint returns: {data}")


class TestWidgetWithTheme:
    """Tests for widget page with theme parameters"""

    def test_widget_loads_with_theme_params(self):
        """Test that widget page loads with theme parameters"""
        theme_params = {
            "instance": INSTANCE_ID,
            "mode": "popup",
            "accent": "#7C3AED",
            "bg": "#0B0A1A",
            "surface": "#1A1040",
            "panel": "#251A4D",
            "border": "rgba(124,58,237,0.2)",
            "userBubble": "#7C3AED"
        }
        response = requests.get(f"{BASE_URL}/widget", params=theme_params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Widget loads with theme parameters")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
