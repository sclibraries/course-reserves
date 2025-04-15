import { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { config } from '../config';
import { jwtDecode } from 'jwt-decode';

// Create the context
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user has permission
  const hasPermission = useCallback((permissionKey) => {
    // Admin users have all permissions
    if (user?.role === 'admin') return true;
    
    // Check permissions array
    return permissions.includes(permissionKey);
  }, [user, permissions]);

  // Initialize auth state from stored tokens
  useEffect(() => {
    const initializeAuth = () => {
      const storedToken = localStorage.getItem('authToken');
      
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
            fetchCompleteUserData();
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
    const fetchCompleteUserData = async () => {
      try {
        const response = await fetch(`${config.api.urls.courseReserves}/user/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
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

    // Check for auth token in URL parameters (coming from Shibboleth redirect)
    const checkUrlParams = () => {
      const params = new URLSearchParams(location.search);
      const urlToken = params.get('token');
      const urlRefreshToken = params.get('refreshToken');
      
      if (urlToken && urlRefreshToken) {
        localStorage.setItem('authToken', urlToken);
        localStorage.setItem('refreshToken', urlRefreshToken);
        
        // Clean URL by removing the tokens
        const cleanUrl = location.pathname;
        navigate(cleanUrl, { replace: true });
        
        // Extract basic info from token for immediate use
        try {
          const decodedToken = jwtDecode(urlToken);
          setUser({ 
            username: decodedToken.username,
            role: decodedToken.role || 'user',
            id: decodedToken.id,
            full_name: decodedToken.full_name,
            email: decodedToken.email,
            institution: decodedToken.institution
          });
          setIsAuthenticated(true);
          setToken(urlToken);
          
          // Then fetch complete data
          setTimeout(() => fetchCompleteUserData(), 500);
        } catch (error) {
          console.error('Error decoding token from URL:', error);
        }
        
        return true;
      }
      return false;
    };

    const hasProcessedUrlParams = checkUrlParams();
    if (!hasProcessedUrlParams) {
      initializeAuth();
    }
  }, [location, navigate]);

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
  }, [token]);

  // Refresh token function
  const refreshToken = async () => {
    try {
      const refreshTokenValue = localStorage.getItem('refreshToken');
      if (!refreshTokenValue) {
        throw new Error('No refresh token available');
      }
      
      const REFRESH_TOKEN_URL = `${config.api.urls.courseReserves}${config.api.endpoints.auth.refreshToken}`;
      
      const response = await fetch(REFRESH_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: refreshTokenValue })
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }
      
      const data = await response.json();
      
      if (data.accessToken && data.refreshToken) {
        localStorage.setItem('authToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        setToken(data.accessToken);
        console.log('Token refreshed successfully');
      } else {
        throw new Error('Invalid token data received');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      handleLogout();
    }
  };

  // Logout handler
  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
    setPermissions([]);
    setIsAuthenticated(false);
    navigate('/');
  }, [navigate]);

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