/**
 * @file Application layout component
 * @module Layout
 * @description Main layout wrapper that structures the application UI with conditional rendering
 * based on route type. Handles different layouts for admin and public-facing pages.
 * @requires react
 * @requires react-router-dom
 * @requires ./Header
 * @requires ./Searchbar
 * @requires ./AppRoutes
 */

import { useLocation } from 'react-router-dom';
import Header from './Header';
import Searchbar from './Searchbar';
import AppRoutes from './AppRoutes';

/**
 * Main application layout component
 * 
 * Provides the structural framework for the application with:
 * - Consistent header across all pages
 * - Search functionality on non-admin pages
 * - Different content layouts for admin vs public pages
 * 
 * The component detects the current route and adjusts the layout accordingly:
 * - Admin routes: Header + content with extra top margin (no search bar)
 * - Public routes: Header + search bar + main content area
 * 
 * @component
 * @example
 * return (
 *   <Router>
 *     <Layout />
 *   </Router>
 * )
 */
const Layout = () => {
  /**
   * Current location from React Router
   * @type {Object}
   */
  const location = useLocation();
  
  /**
   * Whether the current path is an admin route
   * @type {boolean}
   */
  const isAdminPath = location.pathname.startsWith('/admin');

  return (
    <> 
      {/* Header is shown on all pages */}
      <Header />
      
      {/* Search bar only shown on non-admin pages */}
      {!isAdminPath && <Searchbar />}
      
      {/* Different container styling based on route type */}
      {!isAdminPath && (
        <div className="main-content">
          <AppRoutes />
        </div>
      )}
      
      {isAdminPath && (
        <div style={{marginTop: "4em"}}>
          <AppRoutes />
        </div>
      )}
    </>
  );
};

export default Layout;