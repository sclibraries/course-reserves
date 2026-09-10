import axios from 'axios';

/**
 * Read the accessToken cookie set by the PHP auth server after Shibboleth login.
 * The cookie is NOT HttpOnly so JS can attach it as a Bearer header on every request.
 */
function getAccessToken() {
  const match = document.cookie.match(/(^| )accessToken=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : null;
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_BASE_API_URL ?? 'https://libtools2.smith.edu',
  withCredentials: true,
});

// Attach Authorization: Bearer <token> to every outgoing request
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 (trigger logout via custom event) and 423 (submission locked)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // AuthContext listens for this event and calls handleLogout()
      window.dispatchEvent(new CustomEvent('cr:unauthorized'));
    } else if (status === 423) {
      window.dispatchEvent(new CustomEvent('cr:submission-locked'));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
