import axios from "axios";

import { API_BASE } from "./apiBase";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // Send httpOnly cookie when same-origin
});

// Request interceptor: inject Authorization header (primary) + instance ID
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bf_token");
  const instanceId = localStorage.getItem("bf_instance_id");

  // Bearer header works with CORS allow_origins=* in all deployment scenarios
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  if (instanceId && !config.headers["X-Instance-ID"]) {
    config.headers["X-Instance-ID"] = instanceId;
  }
  return config;
});

// Response interceptor: redirect to login on genuine 401 auth failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only logout for real auth failures, not proxy/timeout errors
      const detail = error.response?.data?.detail || "";
      const isAuthError = ["Not authenticated", "Token expired", "Invalid token"].some(msg => detail.includes(msg));
      if (isAuthError || !detail) {
        ["bf_token", "bf_user", "bf_instance", "bf_instance_id", "bf_instances"].forEach(k =>
          localStorage.removeItem(k)
        );
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
