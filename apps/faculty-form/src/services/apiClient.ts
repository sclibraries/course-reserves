import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { getAccessToken, useAuthStore } from '@/store/authStore';
import {
  isAuthAppPath,
  isPathInBasename,
  RETURN_DESTINATION_SESSION_KEY,
} from '@/services/session';

const saveCurrentDestination = () => {
  const basename = import.meta.env.VITE_BASE_PATH || '/';
  const destination = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (isAuthAppPath(window.location.pathname, basename) || !isPathInBasename(destination, basename)) return;
  try { sessionStorage.setItem(RETURN_DESTINATION_SESSION_KEY, destination); } catch { /* Session storage can be disabled. */ }
};

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BASE_API_URL ?? 'https://libtools2.smith.edu',
  withCredentials: true,
});

// Attach Authorization: Bearer <token> to every outgoing request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 (force logout) and 423 (submission locked by staff)
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 401) {
      saveCurrentDestination();
      useAuthStore.getState().logout(true);
    } else if (status === 423) {
      window.dispatchEvent(new CustomEvent('cr:submission-locked'));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
