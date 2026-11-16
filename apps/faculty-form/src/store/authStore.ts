import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { API_ENDPOINTS } from '@/config/endpoints';
import {
  appPathForRoute,
  AUTH_NOTICE_SESSION_KEY,
  type AuthNoticeReason,
  PROXY_INVITATION_SESSION_KEY,
  readCookieValue,
  readSessionFromCookie,
  RETURN_DESTINATION_SESSION_KEY,
  type SessionUser,
} from '@/services/session';
import { useCourseReservesStore } from './courseReservesStore';
import { useActingForStore } from './actingForStore';
import { useCourseAssignmentsStore } from './courseAssignmentsStore';
import { useDraftStore } from './draftStore';

export type User = SessionUser;

export const FACULTY_FORM_AUTH_PATH = appPathForRoute('/auth', import.meta.env.VITE_BASE_PATH || '/');

export const getAccessToken = (): string | null => readCookieValue(document.cookie, 'accessToken');

export const getAuthHeaders = (): HeadersInit => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  logout: (options: { reason: AuthNoticeReason }) => void;
  updateUser: (updates: Partial<User>) => void;
  checkTokenExpiration: () => boolean;
  initializeFromCookie: () => void;
  setMockUser: (fullName: string, internalId?: string, role?: string, institution?: string) => Promise<void>;
}

const persistedDataKeys = [
  'course-reserves-storage',
  'course-assignments-storage',
  'draft-storage',
  'acting-for-selection',
];

const sessionFromCookie = () => readSessionFromCookie(document.cookie, Math.floor(Date.now() / 1000));

const clearAllUserData = () => {
  useCourseReservesStore.getState().clearAllData();
  useCourseReservesStore.setState({ ownerUsername: null });
  useDraftStore.getState().clearAllDrafts();
  useDraftStore.setState({ ownerUsername: null });
  useCourseAssignmentsStore.getState().clearAssignments();
  useCourseAssignmentsStore.getState().clearActingForAssignments();
  useCourseAssignmentsStore.setState({ ownerUsername: null });
  useActingForStore.getState().clearSelection();
  useActingForStore.setState({ ownerUsername: null });
  persistedDataKeys.forEach((key) => localStorage.removeItem(key));
};

const prepareUserData = (username: string) => {
  if (useCourseReservesStore.getState().ownerUsername !== username) {
    useCourseReservesStore.getState().clearAllData();
    useCourseReservesStore.setState({ ownerUsername: username });
  }
  if (useDraftStore.getState().ownerUsername !== username) {
    useDraftStore.getState().clearAllDrafts();
    useDraftStore.setState({ ownerUsername: username });
  }
  if (useCourseAssignmentsStore.getState().ownerUsername !== username) {
    useCourseAssignmentsStore.getState().clearAssignments();
    useCourseAssignmentsStore.getState().clearActingForAssignments();
    useCourseAssignmentsStore.setState({ ownerUsername: username });
  }
  if (useActingForStore.getState().ownerUsername !== username) {
    useActingForStore.getState().clearSelection();
    useActingForStore.setState({ ownerUsername: username });
  }
};

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        isAuthenticated: false,
        loading: false,
        initialized: false,
        error: null,

        logout: ({ reason }) => {
          document.cookie = 'accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Strict';
          clearAllUserData();
          set({ user: null, isAuthenticated: false, loading: false, initialized: true, error: null });
          localStorage.removeItem('auth-store');
          if (reason === 'manual') {
            try {
              sessionStorage.removeItem(RETURN_DESTINATION_SESSION_KEY);
              sessionStorage.removeItem(PROXY_INVITATION_SESSION_KEY);
            } catch { /* Session storage can be disabled. */ }
          }
          try { sessionStorage.setItem(AUTH_NOTICE_SESSION_KEY, reason); } catch { /* Session storage can be disabled. */ }
          window.location.href = FACULTY_FORM_AUTH_PATH;
        },

        updateUser: (updates) => {
          const { user } = get();
          if (user) set({ user: { ...user, ...updates } });
        },

        checkTokenExpiration: () => {
          const user = sessionFromCookie();
          if (!user) {
            get().logout({ reason: 'expired' });
            return false;
          }
          prepareUserData(user.username);
          set({ user, isAuthenticated: true, initialized: true, loading: false });
          return true;
        },

        initializeFromCookie: () => {
          set({ loading: true });
          const user = sessionFromCookie();
          if (!user) {
            clearAllUserData();
            set({ user: null, isAuthenticated: false, loading: false, initialized: true, error: null });
            return;
          }
          prepareUserData(user.username);
          set({ user, isAuthenticated: true, loading: false, initialized: true, error: null });
        },

        setMockUser: async (fullName, internalId, role = 'faculty', institution = 'SM') => {
          set({ loading: true, error: null });
          try {
            const response = await fetch(
              `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.MOCK_LOGIN}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  full_name: fullName,
                  internal_id: internalId,
                  institution,
                  role,
                }),
              },
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
              throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const now = Math.floor(Date.now() / 1000);
            const user = typeof data.token === 'string'
              ? readSessionFromCookie(`accessToken=${encodeURIComponent(data.token)}`, now)
              : null;
            if (!user) throw new Error('Mock login returned an invalid access token');

            document.cookie = `accessToken=${encodeURIComponent(data.token)}; Path=/; SameSite=Strict; Max-Age=${user.exp - now}`;
            prepareUserData(user.username);
            set({ user, isAuthenticated: true, loading: false, initialized: true, error: null });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            set({ loading: false, initialized: true, error: errorMessage, user: null, isAuthenticated: false });
            throw error;
          }
        },
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      },
    ),
    { name: 'auth-store' },
  ),
);
