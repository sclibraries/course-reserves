import { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { config } from '../config';
import { jwtDecode } from 'jwt-decode';
import { apiConfig } from '../config/api.config';


// Create the context
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Check if user has permission
  const hasPermission = useCallback((permissionKey) => {
    // Admin users have all permissions
    if (user?.role === 'admin') return true;
    
    // Check permissions array
    return permissions.includes(permissionKey);
  }, [user, permissions]);

  // Logout handler
  const handleLogout = useCallback(() => {
    // Clear access token cookie (refreshToken is HttpOnly — expires naturally or via server-side logout)
    document.cookie = 'accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Strict';
    setToken(null);
    setUser(null);
    setPermissions([]);
    setIsAuthenticated(false);
    navigate('/');
  }, [navigate]);

  // Refresh token function
  const refreshToken = useCallback(async () => {
    try {
      const refreshUrl = apiConfig.getRefreshTokenUrl();

      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // sends HttpOnly refreshToken cookie automatically
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }
      
      const data = await response.json();
      
      if (data.accessToken) {
        // Update access token cookie — refreshToken rotation handled by HttpOnly Set-Cookie from server
        document.cookie = 'accessToken=' + encodeURIComponent(data.accessToken) + '; Path=/; Secure; SameSite=Strict; Max-Age=3600';
        setToken(data.accessToken);
        console.log('Token refreshed successfully');
      } else {
        throw new Error('Invalid token data received');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      handleLogout();
    }
  }, [handleLogout]);

  // Initialize auth state from stored tokens
  useEffect(() => {
    const initializeAuth = () => {
      const getCookie = (name) => {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : null;
      };
      const storedToken = getCookie('accessToken');
      
      if (storedToken) {
        try {
          const decodedToken = jwtDecode(storedToken);
          const currentTime = Date.now() / 1000;
          
          if (decodedToken.exp > currentTime) {
            setToken(storedToken);
            
            // Set basic user data from token
            setUser({ 
              username: decodedToken.username,
              role: decodedToken.role || 'user', // Default to 'user' if role is not provided
              id: decodedToken.id,
              full_name: decodedToken.full_name,
              email: decodedToken.email,
              institution: decodedToken.institution
            });
            
            setIsAuthenticated(true);
            
            // Fetch complete user data with permissions
            fetchCompleteUserData(storedToken);
          } else {
            // Token expired
            handleLogout();
          }
        } catch (error) {
          console.error('Invalid token:', error);
          handleLogout();
        }
      }
      
      setIsLoading(false);
    };

    // Fetch complete user data from the 'me' endpoint
    const fetchCompleteUserData = async (currentToken) => {
      try {
        const response = await fetch(`${config.api.urls.courseReserves}/user/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const userData = await response.json();
          
          if (userData) {
            // Update user object with full data
            setUser(prevUser => ({
              ...prevUser,
              ...userData,
            }));

            
            // Store permissions if available
            if (userData.permissions) {
              setPermissions(userData.permissions);
            }
          }
        } else if (response.status === 401) {
          // Token might be invalid
          handleLogout();
        }
      } catch (error) {
        console.error('Error fetching complete user data:', error);
      }
    };

    // Initialize auth from secure cookie (set by auth server after Shibboleth login)
    initializeAuth();
  }, [navigate, handleLogout]);

  // Listen for 401 responses from apiClient and trigger logout
  useEffect(() => {
    window.addEventListener('cr:unauthorized', handleLogout);
    return () => window.removeEventListener('cr:unauthorized', handleLogout);
  }, [handleLogout]);

  // Set up token refresh mechanism
  useEffect(() => {
    if (!token) return;
    
    let refreshTimeout;
    
    try {
      const decoded = jwtDecode(token);
      const expTime = decoded.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      // Refresh 5 minutes before expiration
      const timeToRefresh = expTime - currentTime - 5 * 60 * 1000;
      
      if (timeToRefresh <= 0) {
        refreshToken();
      } else {
        refreshTimeout = setTimeout(refreshToken, timeToRefresh);
      }
    } catch (error) {
      console.error('Error setting refresh timer:', error);
      handleLogout();
    }
    
    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
    };
  }, [token, handleLogout, refreshToken]);

  const value = {
    isAuthenticated,
    token,
    user,
    isLoading,
    isAdmin: user?.role === 'admin',
    hasPermission,
    permissions,
    logout: handleLogout,
    refreshToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Add PropTypes for the AuthProvider
AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};