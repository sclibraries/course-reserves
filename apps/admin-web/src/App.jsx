/**
 * @file Main application entry point
 * @module App
 * @description Root component that sets up the application with routing, campus detection,
 * toast notifications, and Font Awesome icons.
 * @requires react
 * @requires react-router-dom
 * @requires react-toastify
 * @requires @fortawesome/fontawesome-svg-core
 */
import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter as Router } from 'react-router-dom';
import Layout from './components/layout/Layout';
import CampusDetection from './components/CampusDetection';
import { ToastContainer } from 'react-toastify';
import { library } from '@fortawesome/fontawesome-svg-core';
import { all } from '@awesome.me/kit-48b7df1f35/icons';
import useCustomizationStore from './store/customizationStore'; // <-- Import the store
import { AuthProvider } from './contexts/AuthContext';
import './css/variables.css'; // Import the new variables CSS file
import './css/App.css';
import 'react-toastify/dist/ReactToastify.css';
import 'react-loading-skeleton/dist/skeleton.css';

// Add all FontAwesome icons to the library
library.add(...all);

// Inner component that uses Router context
const AppContent = () => {
  const error = useCustomizationStore(state => state.error);
  const isLoading = useCustomizationStore(state => state.isLoading);
  
  useEffect(() => {
    console.log('App mounted, attempting to load customizations...');
    
    try {
      // Attempt to load customizations while handling potential errors
      const store = useCustomizationStore.getState();
      console.log('Store retrieved, loadCustomizations exists:', !!store.loadCustomizations);
      
      if (store.loadCustomizations) {
        store.loadCustomizations().catch(err => {
          console.error('Error in loadCustomizations:', err);
        });
      }
    } catch (err) {
      console.error('Failed to access customization store:', err);
    }
  }, []);

  // Monitor loading state changes
  useEffect(() => {
    console.log('Loading state changed:', isLoading);
  }, [isLoading]);
  
  // Keep the error logging effect
  useEffect(() => {
    if (error) {
      console.error('Customization error:', error);
    }
  }, [error]);

  return (
    <>
      <CampusDetection />
      <ToastContainer position="top-right" autoClose={5000} />
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </>
  );
};

/**
 * Root application component that wraps the entire app with necessary providers
 * 
 * @component
 * @example
 * return (
 *   <RootApp />
 * )
 */
const RootApp = ({ router: RouterComponent = Router }) => {
  // Use the environment variable for basename, removing trailing slash if present
  const basename = (import.meta.env.VITE_BASE_PATH || '/course-reserves').replace(/\/$/, '');
  
  return (
    <RouterComponent basename={basename}>
      <AppContent />
    </RouterComponent>
  );
};

export default RootApp;

RootApp.propTypes = {
  router: PropTypes.elementType
};