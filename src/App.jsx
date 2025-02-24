import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route} from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Search from './pages/Search';
import CourseRecords from './pages/CourseRecords';
import Header from './components/Header';
import Searchbar from './components/Searchbar';
import 'react-loading-skeleton/dist/skeleton.css'
import useSearchStore from './store/searchStore';
import { useCurrentTermId } from './hooks/useCurrentTermId';
import ProtectedRoutePage from './components/ProtectedRoutePage';
import ProtectedRoute from './components/ProtectedRoute';
import Admin from './pages/Admin';
import { useLocation } from 'react-router-dom';
import AdminElectronicResources from './components/AdminElectronicResources';
import useRefreshToken from './hooks/useRefreshToken';
import { useNavigate } from 'react-router-dom';

function App() {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [token, setToken] = useState(null);
  const location = useLocation();
  const { termId: autoDetectedTermId, terms, loading, error } = useCurrentTermId();
  const setTermId = useSearchStore((state) => state.setTermId);
  const setTerms = useSearchStore((state) => state.setTerms);
  const selectedTermId = useSearchStore((state) => state.termId);

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setIsAuthorized(false);
    navigate('/login'); // Redirect to your login page or another appropriate route
    alert('Your session has expired. Please log in again.');
  };

  useEffect(() => {
    console.log("App useEffect: terms changed", terms);
    if (!loading && terms?.length > 0) {
      setTerms(terms);
  
      // Only set auto-detected term if selectedTermId is null (i.e. not set by the user)
      if (selectedTermId === null) {
        console.log("App useEffect: setting termId to", autoDetectedTermId);
        setTermId(autoDetectedTermId);
      }
    }
  }, [loading, terms, autoDetectedTermId, selectedTermId, setTerms, setTermId]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tokenFromUrl = queryParams.get('token');
    const storedToken = tokenFromUrl || localStorage.getItem('authToken');
  
    if (storedToken) {
      console.log('Token found:', storedToken);
      setToken(storedToken);
      setIsAuthorized(true);
      localStorage.setItem('authToken', storedToken);
  
      // Clean the URL if the token was in the query string
      if (tokenFromUrl) {
        const newUrl = location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    } else {
      console.log('No token found, user unauthorized.');
      setIsAuthorized(false);
    }
  }, [location]);

  useRefreshToken(token, setToken, logout);

  if (loading) {
    return <div>Loading terms...</div>;
  }
  if (error) {
    return <div>Error loading terms: {error}</div>;
  }

  return (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/records" element={<CourseRecords />} />
          <Route path="/protected-route" element = {<ProtectedRoutePage />} />
          <Route path="/admin"
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
          <Route path="*" element={<h1>Not Found</h1>} />
        </Routes>
  );
}

function Layout() {
  const location = useLocation();

  // If you want to hide the search bar for *any* path that starts with '/admin', you can do:
  const isAdminPath = location.pathname.startsWith('/admin');
  
  return (
    <>
    <Header />

    {/* Only render the search bar if not on admin routes */}
    {!isAdminPath && <Searchbar />}
    {!isAdminPath && <div className="main-content"> <App /> </div>}
    {isAdminPath && <div style={{marginTop: "4em"}}><App /></div>}
  </>
  );
}

function RootApp() {
  return(
    <Router basename="course-reserves">
        <Layout />
    </Router>
  )
}

export default RootApp;
