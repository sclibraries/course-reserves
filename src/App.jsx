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
import  { BrowserRouter as Router } from 'react-router-dom';
import Layout from './components/layout/Layout';
import CampusDetection from './components/CampusDetection';
import { ToastContainer } from 'react-toastify';
import { library } from '@fortawesome/fontawesome-svg-core';
import { all } from '@awesome.me/kit-48b7df1f35/icons';
import useCustomizationStore from './store/customizationStore'; // <-- Import the store
import './css/variables.css'; // Import the new variables CSS file
import './css/App.css';
import 'react-toastify/dist/ReactToastify.css';
import 'react-loading-skeleton/dist/skeleton.css';

// Add all FontAwesome icons to the library
library.add(...all);

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
    <RouterComponent basename="/course-reserves">
      <CampusDetection />
      <ToastContainer position="top-right" autoClose={5000} />
      <Layout />
    </RouterComponent>
  );
};

export default RootApp;

RootApp.propTypes = {
  router: PropTypes.elementType
};
// RootApp.defaultProps is removed since we're using default parameters above