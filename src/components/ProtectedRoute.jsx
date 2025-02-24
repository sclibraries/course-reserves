import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';

const ProtectedRoute = ({ isAuthorized, children }) => {
  if (!isAuthorized) {
    return <Navigate to="/" />;
  }

  return children;
};

export default ProtectedRoute;

ProtectedRoute.propTypes = {
    isAuthorized: PropTypes.bool.isRequired,
    children: PropTypes.node.isRequired,
    };
