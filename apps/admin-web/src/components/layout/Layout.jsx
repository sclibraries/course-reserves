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
 * - Search functionality on non-admin pages (except course records)
 * - Different content layouts based on page type
 * 
 * @component
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
  
  /**
   * Whether the current path is the course records page
   * @type {boolean}
   */
  const isRecordsPage = location.pathname.startsWith('/records');

  /**
   * Determines if the search bar should be shown
   * @type {boolean}
   */
  const showSearchbar = !isAdminPath && !isRecordsPage;

  return (
    <> 
      {/* Header is shown on all pages */}
      <Header />
      
      {/* Search bar only shown on appropriate pages */}
      {showSearchbar && <Searchbar />}
      
      {/* Content with different styling based on whether searchbar is shown */}
      <main id="main-content" className={showSearchbar ? "main-content" : "main-content-no-search"}>
        <AppRoutes />
      </main>
    </>
  );
};

export default Layout;