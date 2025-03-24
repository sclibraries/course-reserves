// components/Layout.jsx
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Searchbar from './Searchbar';
import AppRoutes from './AppRoutes';

const Layout = () => {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  return (
    <> 
    <Header />
    {/* Only render the search bar if not on admin routes */}
    {!isAdminPath && <Searchbar />}
    {!isAdminPath && <div className="main-content">  <AppRoutes /> </div>}
    {isAdminPath && <div style={{marginTop: "4em"}}> <AppRoutes /></div>}
  </>
  );
};

export default Layout;
