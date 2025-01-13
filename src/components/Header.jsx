import { Navbar, NavbarBrand } from 'reactstrap';
import { Link, useLocation } from 'react-router-dom';
import useCustomizationStore from '../store/customizationStore';
import '../Header.css';

function Header() {
  // Grab the current college from URL query parameters
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const college = queryParams.get('college');

  // Pull the relevant customization info from Zustand store
  const { logoUrl, secondaryText, altText, headerBgColor} = useCustomizationStore(
    (state) => state.getCustomizationForCollege(college)
  );

  return (
    <header>
      <Navbar 
        light 
        expand="md" 
        fixed="top" 
        className="shadow-sm"
        style={{ backgroundColor: headerBgColor }}
        >
        <NavbarBrand tag={Link} to="/course-reserves/search">
          {logoUrl ? (
            <>
            <img
              src={logoUrl}
              alt={altText}
              className="college-logo"
            />
            {secondaryText ? (
              <span style={{color: "white"}} className="secondary-text">{secondaryText}</span>
             ) : null }
            </>
          ) : (
            altText
          )}
        </NavbarBrand>
      </Navbar>
    </header>
  );
}

export default Header;
