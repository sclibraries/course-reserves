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
import { Navbar, NavbarBrand, Button, Nav, NavItem, NavLink } from 'reactstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useCustomizationStore from '../../store/customizationStore'; 
import useSearchStore from '../../store/searchStore';
import '../../css/Header.css';
import LoginButton from '../ui/LoginButton';

/**
 * Application header component with dynamic branding and navigation.
 * Handles authentication state, navigation, and college-specific branding.
 * 
 * Features:
 * - Dynamic college branding (logo, colors, text)
 * - Authentication-based navigation display
 * - Role-based access to administrative features
 * - Responsive design for various screen sizes
 * 
 * @component
 * @example
 * return (
 *   <Router>
 *     <Header />
 *     <MainContent />
 *   </Router>
 * )
 */
function Header() {
  // Grab the current college from URL query parameters
  const location = useLocation();
  const navigate = useNavigate();
  const currentCollege = useCustomizationStore((state) => state.currentCollege);
  const setCollege = useSearchStore((state) => state.setCollege);
  const college = currentCollege;
  setCollege(college);

  /**
   * Path detection for active link styling
   * @constant {boolean} isAdminPath - Whether current path is an admin path
   * @constant {boolean} isReportsPath - Whether current path is a reports path
   * @constant {boolean} isCourseManagementPath - Whether current path is a course management path
   */
  const isAdminPath = location.pathname.startsWith('/admin');
  const isReportsPath = location.pathname.startsWith('/admin/reports');
  const isCourseManagementPath = location.pathname.startsWith('/course-reserves/admin');
  
  // Pull the relevant customization info from Zustand store
  const { logoUrl, secondaryText, altText, headerBgColor, campusLocation} = useCustomizationStore(
    (state) => state.getCustomizationForCollege(college)
  );

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

  return (
    <header role="banner" tabIndex="0">
      <Navbar 
        light 
        expand="md" 
        fixed="top" 
        className="shadow-sm py-3"
        style={{ 
          backgroundColor: headerBgColor,
          minHeight: '70px',
          paddingTop: '0px',
          paddingBottom: '5px'
        }}
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
          {/* Show navigation links to logged in users */}
          {isLoggedIn && (
            <Nav navbar className="me-3">
              {/* Reports link for all logged in users */}
              <NavItem className={college === 'smith' ? 'me-3' : ''}>
                <NavLink 
                  tag={Link} 
                  to="/admin/reports" 
                  className={`fw-bold ${isReportsPath ? 'active' : ''}`}
                  style={{ 
                    color: textColor,
                    textDecoration: isReportsPath ? 'underline' : 'none' 
                  }}
                  aria-label="View reports"
                >
                  Reports
                </NavLink>
              </NavItem>
              
              {/* Course Management link - only for Smith users */}
              {college === 'smith' && (
                <NavItem>
                  <NavLink 
                    tag={Link} 
                    to="/admin" 
                    className={`fw-bold ${isCourseManagementPath ? 'active' : ''}`}
                    style={{ 
                      color: textColor,
                      textDecoration: isCourseManagementPath ? 'underline' : 'none' 
                    }}
                    aria-label="Manage courses"
                  >
                    Course Management
                  </NavLink>
                </NavItem>
              )}
            </Nav>
          )}
          
          {/* Login/logout buttons */}
          {(college === 'smith' || isAdminPath) &&
            (isLoggedIn ? (
              <Button color="secondary" onClick={handleLogout} aria-label="Log out">
                Logout
              </Button>
            ) : (
              <LoginButton aria-label="Login to staff account" />
            ))}
        </div>
      </Navbar>
    </header>
  );
}

export default Header;