/**
 * @file Application routing configuration
 * @module AppRoutes
 * @description Defines all application routes and enforces authorization for protected routes.
 * Handles loading states for initial setup and integrates with the authentication system.
 * @requires react-router-dom
 * @requires @/pages
 * @requires @/components/protected
 * @requires @/hooks/useAuth
 * @requires @/hooks/useTermSetup
 */
import { Routes, Route } from 'react-router-dom';
import Home from '../../pages/Home';
import Search from '../../pages/Search';
import CourseRecords from '../../pages/CourseRecords';
import ProtectedRoutePage from '../protected/ProtectedRoutePage';
import ProtectedRoute from '../protected/ProtectedRoute';
import Admin from '../../pages/Admin';
import AdminElectronicResources from '../../pages/AdminElectronicResources';
import NotFound from '../../pages/NotFound';
import useAuth from '../../hooks/useAuth';
import useTermSetup from '../../hooks/useTermSetup';
import TrackingReport from '../../pages/TrackingReport';


/**
 * Application routes component
 * 
 * Configures all application routes and applies authentication protection to restricted routes.
 * Preloads necessary data like term information before rendering routes.
 * 
 * Route structure:
 * - Public routes: Home, Search, Course Records
 * - Protected routes: Admin, Electronic Resources, Reports
 * - Special routes: 404 Not Found
 * 
 * @component
 * @example
 * return (
 *   <Router>
 *     <AppRoutes />
 *   </Router>
 * )
 */
const AppRoutes = () => {
  /**
   * Authentication state from auth hook
   * @type {Object}
   * @property {boolean} isAuthorized - Whether the user is authenticated and authorized
   */
  const { isAuthorized } = useAuth();
  
  /**
   * Term setup loading state
   * @type {Object}
   * @property {boolean} loading - Whether term data is being loaded
   * @property {string|null} error - Error message if term loading failed
   */
  const { loading, error } = useTermSetup();

  // Show loading state while terms are being fetched
  if (loading) return <div>Loading terms...</div>;
  
  // Show error state if term loading failed
  if (error) return <div>Error loading terms: {error}</div>;

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/search" element={<Search />} />
      <Route path="/records" element={<CourseRecords />} />
      <Route path="/records/:uuid" element={<CourseRecords />} />
      <Route path="/records/course-code/:courseCode" element={<CourseRecords />} />
      <Route path="/protected-route" element={<ProtectedRoutePage />} />
      
      {/* Protected Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute isAuthorized={isAuthorized}>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/electronic/:folioCourseId"
        element={
          <ProtectedRoute isAuthorized={isAuthorized}>
            <AdminElectronicResources />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/admin/reports"
        element={
          <ProtectedRoute isAuthorized={isAuthorized}>
            <TrackingReport />
          </ProtectedRoute>
        }
      />
      
      {/* Catch-all 404 route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;