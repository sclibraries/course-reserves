/**
 * @file Application header component
 * @module Header
 * @description Main navigation header with dynamic college branding and authenticated user controls.
 * Displays college-specific logo and provides navigation links for authenticated users.
 * @requires react
 * @requires reactstrap
 * @requires react-router-dom
 * @requires ../../store/customizationStore
 * @requires ../../store/searchStore
 */
import { useEffect, useState } from 'react';
import { Navbar, NavbarBrand, Button} from 'reactstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useCustomizationStore from '../../store/customizationStore'; 
import useSearchStore from '../../store/searchStore';
import '../../css/Header.css';
import LoginButton from '../ui/LoginButton';

/**
 * Application header component with dynamic branding and navigation.
 */
function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Add path checks for conditional rendering
  const isAdminPath = location.pathname.startsWith('/admin');
    (location.pathname.startsWith('/admin') && !location.pathname.startsWith('/admin/reports'));
  
  const currentCollege = useCustomizationStore((state) => state.currentCollege);
  const setSearchStoreCollege = useSearchStore((state) => state.setCollege);
  
  // Get college from URL or default
  const college = new URLSearchParams(location.search).get('college') || currentCollege || 'default';

  // Set college in search store once Header component mounts or college changes
  useEffect(() => {
    setSearchStoreCollege(college);
  }, [college, setSearchStoreCollege]);

  // Grab customization from store with error handling
  const customization = useCustomizationStore((state) => {
    return state.getCustomizationForCollege(college) || {};
  });
  
  const {
    logoUrl = '',
    secondaryText = 'Course Reserves',
    altText = 'Library Course Reserves',
    headerBgColor = '#ffffff',
    campusLocation = 'default'
  } = customization;

  /**
   * Authentication state
   * @type {boolean}
   */
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  /**
   * Check authentication status on component mount
   */
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    setIsLoggedIn(!!token);
  }, []);

  /**
   * Handles user logout by removing tokens and redirecting
   * @function
   * @returns {void}
   */
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    setIsLoggedIn(false);
    navigate('/');
  };

  /**
   * Text color based on campus
   * @constant {string} textColor - Color value based on campus
   */
  const textColor = campusLocation === "smith" ? "black" : "white";

  // Add college-specific theme class to enable CSS variable theming
  const collegeThemeClass = `${college}-theme`;

  return (
    <header role="banner" tabIndex="0" className={collegeThemeClass}>
      <Navbar 
        light 
        expand="md" 
        fixed="top" 
        className="shadow-sm"
        style={{ 
          backgroundColor: headerBgColor,
          minHeight: '70px',
        }}
      >
        <div className="container-fluid d-flex justify-content-between align-items-center">
          <NavbarBrand tag={Link} to={"/search?college=" + college} className="d-flex align-items-center">
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
                  style={{ color: textColor }}
                >
                  {altText} Home
                </span>
                {secondaryText ? (
                  <span
                    className="secondary-text"
                    style={{ color: textColor }}
                  >
                    {secondaryText}
                  </span>
                ) : null}
              </>
            ) : (
              altText
            )}
          </NavbarBrand>
          
          {/* Navigation and auth section */}
          <div className="d-flex align-items-center">
            
            {/* Login/logout buttons */}
            {(college === 'smith' || isAdminPath) &&
              (isLoggedIn ? (
                <Button 
                  color="secondary" 
                  onClick={handleLogout} 
                  aria-label="Log out"
                  className="custom-action-btn tertiary-action-btn"
                >
                  Logout
                </Button>
              ) : (
                <LoginButton 
                  aria-label="Login to staff account" 
                  className="custom-action-btn primary-action-btn"
                />
              ))}
          </div>
        </div>
      </Navbar>
    </header>
  );
}

export default Header;