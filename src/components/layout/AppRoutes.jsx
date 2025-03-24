// components/AppRoutes.jsx
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

const AppRoutes = () => {
  const { isAuthorized } = useAuth();
  const { loading, error } = useTermSetup();

  if (loading) return <div>Loading terms...</div>;
  if (error) return <div>Error loading terms: {error}</div>;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/search" element={<Search />} />
      <Route path="/records" element={<CourseRecords />} />
      <Route path="/records/:uuid" element={<CourseRecords />} />
      <Route path="/records/course-code/:courseCode" element={<CourseRecords />} />
      <Route path="/protected-route" element={<ProtectedRoutePage />} />
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
