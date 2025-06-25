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
import { useEffect, useState, useMemo } from 'react';
import { Navbar, NavbarBrand, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { Link, useLocation } from 'react-router-dom';
import { FaUser, FaHome, FaChevronDown } from 'react-icons/fa';
import useCustomizationStore from '../../store/customizationStore';
import useSearchStore from '../../store/searchStore';
import { useAuth } from '../../contexts/AuthContext';
import '../../css/Header.css';
import LoginButton from '../ui/LoginButton';

/**
 * Calculates whether text on a background should be light or dark
 * @param {string} backgroundColor - Hex or RGB color value
 * @returns {string} - Returns 'light' or 'dark' based on background luminance
 */
const getTextColorForBackground = (backgroundColor) => {
  if (!backgroundColor || backgroundColor === 'transparent') {
    return 'dark';
  }

  let r, g, b;

  if (backgroundColor.startsWith('#')) {
    const hex = backgroundColor.replace('#', '');
    const fullHex = hex.length === 3
      ? hex.split('').map(c => c + c).join('')
      : hex;

    r = parseInt(fullHex.substring(0, 2), 16);
    g = parseInt(fullHex.substring(2, 4), 16);
    b = parseInt(fullHex.substring(4, 6), 16);
  } else if (backgroundColor.startsWith('rgb')) {
    const rgbValues = backgroundColor.match(/\d+/g);
    if (rgbValues && rgbValues.length >= 3) {
      r = parseInt(rgbValues[0], 10);
      g = parseInt(rgbValues[1], 10);
      b = parseInt(rgbValues[2], 10);
    } else {
      return 'dark';
    }
  } else {
    return 'dark';
  }

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance < 128 ? 'light' : 'dark';
};

/**
 * Application header component with dynamic branding and navigation.
 */
function Header() {
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isAdminPath = location.pathname.startsWith('/admin');

  const currentCollege = useCustomizationStore((state) => state.currentCollege);
  const setSearchStoreCollege = useSearchStore((state) => state.setCollege);

  const college = new URLSearchParams(location.search).get('college') || currentCollege || 'default';

  const { isAuthenticated, logout, user } = useAuth();

  const toggleUserMenu = () => setUserMenuOpen(!userMenuOpen);

  useEffect(() => {
    setSearchStoreCollege(college);
  }, [college, setSearchStoreCollege]);

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

  const textColorMode = useMemo(() =>
    getTextColorForBackground(headerBgColor), [headerBgColor]);

  const navLinkStyle = useMemo(() => {
    const baseStyle = {
      color: textColorMode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)',
      transition: 'color 0.2s ease',
    };

    return baseStyle;
  }, [textColorMode]);

  const activeNavLinkStyle = useMemo(() => ({
    ...navLinkStyle,
    color: textColorMode === 'light' ? '#ffffff' : '#000000',
    fontWeight: '600',
  }), [navLinkStyle, textColorMode]);

  const logoTextColor = campusLocation === "smith" ? "black" : "white";

  const collegeThemeClass = `${college}-theme`;

  const getUserDisplayName = () => {
    if (!user) return null;

    if (user.full_name) {
      const nameParts = user.full_name.trim().split(' ');
      if (nameParts.length > 1) {
        return `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`;
      }
      return user.full_name;
    }

    if (user.username) {
      if (user.username.includes('@')) {
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
                  style={{ color: logoTextColor }}
                >
                  {altText} Home
                </span>
                {secondaryText ? (
                  <span
                    className="secondary-text"
                    style={{ color: logoTextColor }}
                  >
                    {secondaryText}
                  </span>
                ) : null}
              </>
            ) : (
              <span style={{ color: 'black' }}>{altText}</span>
            )}
          </NavbarBrand>

          <div className="d-flex align-items-center">
            {/* Only show Home link when on admin pages, since the logo already links to home */}
            {isAdminPath && (
              <Link
                to={"/search?college=" + college}
                className="nav-link me-3"
                aria-label="Go to course reserves home page"
                style={navLinkStyle}
              >
                <FaHome className="me-1" /> Home
              </Link>
            )}

            {isAuthenticated && (
              <Link
                to="/admin?tab=courses"
                className={`nav-link me-3 ${isAdminPath ? 'active' : ''}`}
                aria-label="Go to admin page"
                style={isAdminPath ? activeNavLinkStyle : navLinkStyle}
              >
                Admin
              </Link>
            )}

            {(college === 'smith' || isAdminPath) && (
              isAuthenticated ? (
                <Dropdown isOpen={userMenuOpen} toggle={toggleUserMenu} direction="down">
                  <DropdownToggle
                    caret
                    color={textColorMode === 'light' ? 'dark' : 'light'}
                    className="user-menu-toggle"
                  >
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
                  color={textColorMode === 'light' ? 'light' : 'primary'}
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