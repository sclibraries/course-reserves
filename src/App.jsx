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

import { BrowserRouter as Router } from 'react-router-dom';
import Layout from './components/layout/Layout';
import CampusDetection from './components/CampusDetection';
import { ToastContainer } from 'react-toastify';
import { library } from '@fortawesome/fontawesome-svg-core';
import { all } from '@awesome.me/kit-48b7df1f35/icons';
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
const RootApp = () => (
  <Router basename="/course-reserves">
    <CampusDetection />
    <ToastContainer />
    <Layout />
  </Router>
);

export default RootApp;