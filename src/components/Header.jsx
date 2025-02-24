import { Navbar, NavbarBrand } from 'reactstrap';
import { Link, useLocation } from 'react-router-dom';
import useCustomizationStore from '../store/customizationStore';
import '../Header.css';
import LoginButton from './StaffLogin';

function Header() {
  // Grab the current college from URL query parameters
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const college = queryParams.get('college');
  const isAdminPath = location.pathname.startsWith('/admin');

  // Pull the relevant customization info from Zustand store
  const { logoUrl, secondaryText, altText, headerBgColor, campusLocation} = useCustomizationStore(
    (state) => state.getCustomizationForCollege(college)
  );

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

        {(college === 'smith' || isAdminPath) && (
          <LoginButton aria-label="Login to staff account" />
        )}

      </Navbar>
    </header>
  );
}

export default Header;
