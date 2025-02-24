import LoginButton from "./StaffLogin";
import { Link } from 'react-router-dom';
function ProtectedRoutePage() {
  return (
    <div>
        <h1>Authorization required</h1>
        <p>This page requires authorization to access. Please log in</p>
        <LoginButton />{ ' ' }  
        <Link className="btn btn-primary" to="/">Back to home</Link>{ ' ' } 
        {/* <Link className="btn btn-primary" to="/request-access">Request access</Link>{ ' ' }  */}
    </div>
  );
}

export default ProtectedRoutePage;