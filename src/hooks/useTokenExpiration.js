// useTokenExpiration.js
import { useEffect } from 'react';
import jwtDecode from 'jwt-decode';

/**
 * Custom hook to monitor token expiration.
 * @param {string} token - The JWT token.
 * @param {Function} onExpire - Callback to execute when token expires.
 */
const useTokenExpiration = (token, onExpire) => {
  useEffect(() => {
    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      const expirationTime = decoded.exp * 1000; // convert from seconds to ms
      const currentTime = Date.now();
      const delay = expirationTime - currentTime;

      if (delay <= 0) {
        // Token has already expired
        onExpire();
      } else {
        // Set a timeout to trigger logout when token expires
        const timeoutId = setTimeout(() => {
          onExpire();
        }, delay);

        // Clean up the timeout on unmount or token change
        return () => clearTimeout(timeoutId);
      }
    } catch (err) {
      console.error('Error decoding token:', err);
      // If decoding fails, log out immediately
      onExpire();
    }
  }, [token, onExpire]);
};

export default useTokenExpiration;
