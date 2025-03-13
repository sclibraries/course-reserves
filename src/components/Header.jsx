import { useEffect, useState } from 'react';
import { Navbar, NavbarBrand, Button } from 'reactstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useCustomizationStore from '../store/customizationStore';
import useSearchStore from '../store/searchStore';
import '../Header.css';
import LoginButton from './StaffLogin';


function Header() {
  // Grab the current college from URL query parameters
  const location = useLocation();
  const navigate = useNavigate();
  // const queryParams = new URLSearchParams(location.search);
  // const college = queryParams.get('college');
  const currentCollege = useCustomizationStore((state) => state.currentCollege);
  const setCollege = useSearchStore((state) => state.setCollege);
  const college = currentCollege;
  setCollege(college);

  const isAdminPath = location.pathname.startsWith('/admin');

  // Pull the relevant customization info from Zustand store
  const { logoUrl, secondaryText, altText, headerBgColor, campusLocation} = useCustomizationStore(
    (state) => state.getCustomizationForCollege(college)
  );

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    setIsLoggedIn(!!token);
  }, []);

    // Logout handler: remove tokens, update state, and redirect the user
    const handleLogout = () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      setIsLoggedIn(false);
      navigate('/');
    };

  return (
      <header role="banner" tabIndex="0">
        <Navbar 
          light 
          expand="md" 
          fixed="top" 
          className="shadow-sm"
          style={{ backgroundColor: headerBgColor }}
        >
  
        <NavbarBrand tag={Link} to={"/search?college=" + college}>
        {logoUrl ? (
          <>
            <img
              src={logoUrl}
              className="college-logo"
              alt=''
              role="presentation"
            />
            <span 
              className="visually-hidden"
              style={{
                color: campusLocation === "smith" ? "black" : "white",
              }}
            >
              {altText} Home
            </span>
            {secondaryText ? (
              <span
                className="secondary-text"
                style={{
                  color: campusLocation === "smith" ? "black" : "white",
                }}
              >
                {secondaryText}
              </span>
            ) : null}
          </>
        ) : (
          altText
        )}
      </NavbarBrand>

      {(college === 'smith' || isAdminPath) &&
        (isLoggedIn ? (
          <Button color="secondary" onClick={handleLogout} aria-label="Log out">
            Logout
          </Button>
        ) : (
          <LoginButton aria-label="Login to staff account" />
        ))}

      </Navbar>
    </header>
  );
}

export default Header;
