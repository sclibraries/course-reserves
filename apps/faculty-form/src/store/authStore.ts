import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { API_ENDPOINTS } from '@/config/endpoints';
import { clearCourseReservesStorage } from './courseReservesStore';
import { useActingForStore } from './actingForStore';

export const FACULTY_FORM_AUTH_PATH = '/form/auth';

// Helper function to get the access token
export const getAccessToken = (): string | null => {
  const match = document.cookie.match(/(^| )accessToken=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : null;
};

// Helper function to get auth headers for API calls
export const getAuthHeaders = (): HeadersInit => {
  const token = getAccessToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Types based on Shibboleth cookie data
export interface User {
  iat: number; // issued at
  exp: number; // expiration
  username: string;
  role: string;
  id: string; // same as username for now
  full_name: string;
  email: string;
  institution: string;
  internal_id?: string; // Smith ID for course lookup
}

interface AuthState {
  // Data
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  login: (userData: Omit<User, 'iat' | 'exp'>) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  checkTokenExpiration: () => boolean;
  initializeFromCookie: () => void;
  
  // Mock data for testing
  setMockUser: (fullName: string, internalId?: string, role?: string, institution?: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,

        // Login with user data (simulates Shibboleth cookie processing)
        login: (userData) => {
          const now = Math.floor(Date.now() / 1000);
          const user: User = {
            ...userData,
            iat: now,
            exp: now + (8 * 60 * 60), // 8 hours from now
            id: userData.username
          };
          
          console.log('🔐 User logged in:', user.full_name, `(${user.role})`);
          
          set({
            user,
            isAuthenticated: true,
            loading: false,
            error: null
          });
        },

        // Logout
        logout: () => {
          console.log('🚪 User logged out');
          useActingForStore.getState().clearSelection();
          
          // Optional: mark logout in progress for other modules that may read it
          sessionStorage.setItem('logout-in-progress', 'true');
          
          // Step 1: Clear auth state
          set({
            user: null,
            isAuthenticated: false,
            loading: false,
            error: null
          });
          
          // Step 2: Clear auth tokens
          try {
            // Clear course reserves data from memory
            clearCourseReservesStorage();
            
          // Clear access token cookie (refreshToken is HttpOnly — expires naturally or via server-side logout)
            document.cookie = 'accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Strict';
            localStorage.removeItem('auth-store');
            localStorage.removeItem('course-reserves-storage');
            localStorage.removeItem('course-assignments-storage');
            localStorage.removeItem('draft-storage');
            console.log('🗑️ Cleared auth tokens and state');
          } catch (error) {
            console.error('Failed to clear localStorage:', error);
          }
          
          // Step 3: Clear the session flag and redirect to auth page
          // Note: sessionStorage persists across reloads in the same tab, so remove it explicitly
          try {
            sessionStorage.removeItem('logout-in-progress');
          } catch (e) {
            // Non-fatal: session storage may be unavailable in some environments
            console.debug('Could not clear logout flag from sessionStorage', e);
          }
          
          // Redirect to the faculty form auth page outside React Router.
          window.location.href = FACULTY_FORM_AUTH_PATH;
        },

        // Update user information
        updateUser: (updates) => {
          const { user } = get();
          if (user) {
            const updatedUser = { ...user, ...updates };
            console.log('👤 User updated:', updates);
            set({ user: updatedUser });
          }
        },

        // Check if token is expired
        checkTokenExpiration: () => {
          const { user } = get();
          if (!user) return false;
          
          const now = Math.floor(Date.now() / 1000);
          const isExpired = now >= user.exp;
          
          if (isExpired) {
            console.warn('⏰ Token expired, logging out');
            get().logout();
            return false;
          }
          
          return true;
        },

        // Initialize from cookie (in production, this would read the Shibboleth cookie)
        initializeFromCookie: () => {
          set({ loading: true });

          // Read access token from cookie set by the auth server
          const accessToken = getAccessToken();
          if (accessToken) {
            const { user } = get();
            if (user && get().checkTokenExpiration()) {
              console.log('🔄 Restored user session:', user.full_name);
              set({ isAuthenticated: true, loading: false });
              return;
            }
          }

          console.log('🔍 No valid session found');
          set({ loading: false });
        },

        // Mock user login for testing - calls backend mock-login endpoint
        setMockUser: async (fullName, internalId, role = 'faculty', institution = 'SM') => {
          console.log('🧪 Setting mock user:', fullName, 'ID:', internalId);
          set({ loading: true, error: null });
          
          try {
            const response = await fetch(
              `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}/faculty-submission/mock-login`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include', // accepts HttpOnly refreshToken cookie from server
                body: JSON.stringify({
                  full_name: fullName,
                  internal_id: internalId,
                  institution: institution,
                  role: role,
                }),
              }
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
              throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            
            console.log('✅ Mock login successful:', data.user);
            console.log('⚠️ Warning:', data.warning);
            
            // Store access token in cookie — refreshToken set as HttpOnly cookie by server
            document.cookie = 'accessToken=' + encodeURIComponent(data.token) + '; Path=/; SameSite=Strict; Max-Age=3600';
            
            // Update state with user data from backend, including internal_id
            set({
              user: {
                ...data.user,
                internal_id: internalId, // Store the internal_id
                iat: Math.floor(Date.now() / 1000),
                id: data.user.username,
              },
              isAuthenticated: true,
              loading: false,
              error: null,
            });
            
          } catch (error) {
            console.error('❌ Mock login failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            set({ 
              loading: false,
              error: errorMessage,
              user: null,
              isAuthenticated: false
            });
            throw error;
          }
        }
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated
        })
      }
    ),
    {
      name: 'auth-store'
    }
  )
);
