import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { getAccessToken, useAuthStore } from '@/store/authStore';

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
      useAuthStore.getState().logout();
    } else if (status === 423) {
      window.dispatchEvent(new CustomEvent('cr:submission-locked'));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
