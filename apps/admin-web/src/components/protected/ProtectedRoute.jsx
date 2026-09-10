import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show a loading state while checking authentication
  if (isLoading) {
    return <div>Loading authentication status...</div>;
  }

  // Redirect to the protected route page if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  // If authenticated, render the protected content
  return children;
};

export default ProtectedRoute;

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};
