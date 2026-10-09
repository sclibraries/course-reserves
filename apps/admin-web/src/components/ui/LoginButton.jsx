import { apiConfig } from '../../config/api.config';
import PropTypes from 'prop-types';

const LoginButton = ({ textColor = "#1A2C57" }) => {
  // Get the appropriate auth URL for the current environment
  const authUrl = apiConfig.getAuthUrl();
  const isProduction = apiConfig.environment === 'production';
  const envLabel = isProduction ? '' : `(${apiConfig.environment.toUpperCase()})`;

  console.log(`Using auth URL for environment: ${apiConfig.environment}`, authUrl);

  return (
    <>
      <a
        href={authUrl}
        className="staff-login-link"
        role="link"
        aria-label="Admin Login (opens Shibboleth authentication page)"
        style={{ 
          color: textColor,
          textDecoration: 'underline',
        }}
      >
        Admin Login {envLabel}
      </a>
      
      {!isProduction && (
        <div style={{ 
          fontSize: '10px', 
          color: '#c22', 
          marginTop: '2px',
          backgroundColor: '#ffeeee',
          padding: '1px 4px',
          borderRadius: '2px',
        }}>
          Development Environment
        </div>
      )}
    </>
  );
};


LoginButton.propTypes = {
  textColor: PropTypes.string
};

export default LoginButton;