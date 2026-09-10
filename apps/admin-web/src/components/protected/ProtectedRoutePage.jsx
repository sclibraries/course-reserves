import { Link } from 'react-router-dom';
import LoginButton from '../ui/LoginButton';

function ProtectedRoutePage() {
  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <div className="card shadow">
            <div className="card-body p-4">
              <h1 className="card-title text-center mb-4">Authentication Required</h1>
              <p className="card-text text-center mb-4">
                This page requires authentication to access. Please log in with your credentials.
              </p>
              
              <div className="d-flex flex-column align-items-center gap-3">
                <LoginButton />
                <p className="text-center mt-3">
                  Don&apos;t have an account? <Link to="/register">Register here</Link>
                </p>
                <Link className="btn btn-outline-secondary" to="/">
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProtectedRoutePage;