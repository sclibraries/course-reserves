import { apiConfig } from '../../config/api.config';

const LoginButton = () => {
  // Get the appropriate auth URL for the current environment
  const authUrl = apiConfig.getAuthUrl();
  const isDevelopment = apiConfig.environment !== 'production';

  console.log(`Using auth URL for environment: ${apiConfig.environment}`, authUrl);

  return (
    <>
      <a
        href={authUrl}
        className="staff-login-link"
        role="link"
        aria-label="Staff Login (opens Shibboleth authentication page)"
        style={{ 
          color: "#1A2C57",
          textDecoration: 'underline',
        }}
      >
        Staff Login {isDevelopment && '(DEV)'}
      </a>
      
      {isDevelopment && (
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

export default LoginButton;