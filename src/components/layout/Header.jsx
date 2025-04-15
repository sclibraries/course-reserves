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
import { Navbar, NavbarBrand,  Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { Link, useLocation } from 'react-router-dom';
import { FaUser, FaHome, FaChevronDown } from 'react-icons/fa';
import useCustomizationStore from '../../store/customizationStore'; 
import useSearchStore from '../../store/searchStore';
import { useAuth } from '../../contexts/AuthContext';
import '../../css/Header.css';
import LoginButton from '../ui/LoginButton';

/**
 * Application header component with dynamic branding and navigation.
 */
function Header() {
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  // Add path checks for conditional rendering
  const isAdminPath = location.pathname.startsWith('/admin');
  
  const currentCollege = useCustomizationStore((state) => state.currentCollege);
  const setSearchStoreCollege = useSearchStore((state) => state.setCollege);
  
  // Get college from URL or default
  const college = new URLSearchParams(location.search).get('college') || currentCollege || 'default';

  // Get authentication status from context
  const { isAuthenticated, logout, user } = useAuth();

  // Toggle user menu dropdown
  const toggleUserMenu = () => setUserMenuOpen(!userMenuOpen);

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
   * Text color based on campus
   * @constant {string} textColor - Color value based on campus
   */
  const textColor = campusLocation === "smith" ? "black" : "white";

  // Add college-specific theme class to enable CSS variable theming
  const collegeThemeClass = `${college}-theme`;

  // Format username for display with privacy in mind
  const getUserDisplayName = () => {
    if (!user) return null;
    
    // If user has a full name, show first name + first initial of last name
    if (user.full_name) {
      const nameParts = user.full_name.trim().split(' ');
      if (nameParts.length > 1) {
        return `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`;
      }
      return user.full_name;
    }
    
    // Fallback to username (avoid showing email address in full)
    if (user.username) {
      if (user.username.includes('@')) {
        // If it's an email, show only the part before @
        return user.username.split('@')[0];
      }
      return user.username;
    }
    
    return 'User';
  };

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
              <span style={{color: 'black'}}>{altText}</span>
            )}
          </NavbarBrand>
          
          {/* Navigation and auth section */}
          <div className="d-flex align-items-center">
            {/* Home button - always visible */}
            <Link 
              to={"/search?college=" + college} 
              className={`nav-link me-3 ${!isAdminPath ? 'active' : ''}`}
              aria-label="Go to course reserves home page"
            >
              <FaHome className="me-1" /> Home
            </Link>
            
            {/* Admin link - only visible when authenticated */}
            {isAuthenticated && (
              <Link 
                to="/admin?tab=courses" 
                className={`nav-link me-3 ${isAdminPath ? 'active' : ''}`}
                aria-label="Go to admin page"
              >
                Admin
              </Link>
            )}
            
            {/* User menu/authentication buttons */}
            {(college === 'smith' || isAdminPath) && (
              isAuthenticated ? (
                <Dropdown isOpen={userMenuOpen} toggle={toggleUserMenu} direction="down">
                  <DropdownToggle caret color="light" className="user-menu-toggle">
                    <FaUser className="me-2" />
                    <span className="user-name">{getUserDisplayName()}</span>
                    <FaChevronDown className="ms-2" />
                  </DropdownToggle>
                  <DropdownMenu end className="user-menu">
                    {user && user.role && (
                      <DropdownItem header>Role: {user.role}</DropdownItem>
                    )}
                    <DropdownItem divider />
                    <DropdownItem onClick={logout}>
                      Logout
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              ) : (
                <LoginButton 
                  aria-label="Login to staff account" 
                  className="custom-action-btn primary-action-btn"
                />
              )
            )}
          </div>
        </div>
      </Navbar>
    </header>
  );
}

export default Header;