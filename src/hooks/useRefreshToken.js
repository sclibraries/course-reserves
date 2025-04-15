// src/hooks/useRefreshToken.js
import { useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { apiConfig } from '../config/api.config';

/**
 * Custom hook to automatically refresh the access token.
 *
 * @param {string} token - The current access token.
 * @param {Function} setToken - State setter to update the access token.
 * @param {Function} logout - Callback to log out the user.
 */
const useRefreshToken = (token, setToken, logout) => {
  useEffect(() => {
    if (!token) return;

    let timeoutId;

    try {
      // Decode the current token to get the expiration time (in seconds)
      const decoded = jwtDecode(token);
      const expirationTime = decoded.exp * 1000; // convert to milliseconds

      // Calculate time remaining until token expires
      const currentTime = Date.now();
      // Set the refresh to occur 1 minute before expiration
      const refreshDelay = expirationTime - currentTime - 60000;

      // If the token is already close to expiring, refresh immediately
      if (refreshDelay <= 0) {
        refreshAccessToken();
      } else {
        // Set a timer to refresh the token
        timeoutId = setTimeout(() => {
          refreshAccessToken();
        }, refreshDelay);
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      logout();
    }

    // Cleanup timer on token change or unmount
    return () => clearTimeout(timeoutId);

    // --- Helper function to call the refresh endpoint ---
    async function refreshAccessToken() {
      try {
        const storedRefreshToken = localStorage.getItem('refreshToken');
        if (!storedRefreshToken) {
          throw new Error('No refresh token available');
        }
        const refreshUrl = apiConfig.getRefreshTokenUrl();
          
        // Call the backend refresh endpoint
        const response = await fetch(refreshUrl, {
          method: 'POST',
          credentials: 'include', // if your backend uses cookies
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken: storedRefreshToken })
        });

        if (!response.ok) {
          throw new Error('Failed to refresh token');
        }

        const data = await response.json();
        if (data.accessToken && data.refreshToken) {
          // Update tokens in localStorage and state
          localStorage.setItem('authToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          setToken(data.accessToken);
          console.log('Token refreshed successfully.');
        } else {
          throw new Error('Invalid token data received');
        }
      } catch (error) {
        console.error('Error refreshing token:', error);
        logout();
      }
    }
  }, [token, setToken, logout]);
};

export default useRefreshToken;
