
const LoginButton = () => {

  return (
    <a
      href="https://libtools2.smith.edu/course-reserves/backend/admin/authorize.php"
      className="staff-login-link"
      role="link"
      aria-label="Staff Login (opens Shibboleth authentication page)"
      style={{ 
        color: "#1A2C57",
        textDecoration: 'underline',
      }}
    >
      Staff Login
    </a>
  );
};

export default LoginButton;
