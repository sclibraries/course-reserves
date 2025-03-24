// hooks/useAuth.js
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useRefreshToken from './useRefreshToken';

const useAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [token, setToken] = useState(null);

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setIsAuthorized(false);
    navigate('/');
    alert('Your session has expired. Please log in again.');
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tokenFromUrl = queryParams.get('token');
    const refreshTokenFromUrl = queryParams.get('refreshToken');
    const storedToken = tokenFromUrl || localStorage.getItem('authToken');

    if (storedToken) {
      setToken(storedToken);
      setIsAuthorized(true);
      localStorage.setItem('authToken', storedToken);

      if (refreshTokenFromUrl) {
        localStorage.setItem('refreshToken', refreshTokenFromUrl);
      }

      if (tokenFromUrl) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    } else {
      setIsAuthorized(false);
    }
  }, [location]);

  useRefreshToken(token, setToken, logout);

  return { isAuthorized, token, logout };
};

export default useAuth;
