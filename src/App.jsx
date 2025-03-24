// RootApp.jsx
import { BrowserRouter as Router } from 'react-router-dom';
import Layout from './components/layout/Layout';
import CampusDetection from './components/CampusDetection';
import { ToastContainer } from 'react-toastify';
import { library } from '@fortawesome/fontawesome-svg-core';
import { all } from '@awesome.me/kit-48b7df1f35/icons';
import './css/App.css';
import 'react-toastify/dist/ReactToastify.css';
import 'react-loading-skeleton/dist/skeleton.css';

library.add(...all);

const RootApp = () => (
  <Router basename="/course-reserves">
    <CampusDetection />
    <ToastContainer />
    <Layout />
  </Router>
);

export default RootApp;
