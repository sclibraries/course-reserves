/**
 * @file Application entry point
 * @module main
 * @description Bootstrap the React application by mounting the App component to the DOM.
 * This file serves as the entry point for the Vite bundler and initializes the React application.
 * It sets up StrictMode for additional development checks and mounts the root component.
 * @requires react
 * @requires react-dom/client
 * @requires bootstrap/dist/css/bootstrap.min.css
 * @requires ./App.jsx
 * @requires ./css/index.css
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import App from './App.jsx'
import './css/index.css'

/**
 * Creates a React root in the DOM and renders the application
 * @function
 * @name renderApp
 * @description Initializes the React application by creating a root and rendering
 * the App component wrapped in StrictMode. StrictMode enables additional development
 * checks and warnings for best practices.
 * @see {@link https://react.dev/reference/react/StrictMode React StrictMode Documentation}
 * @see {@link https://react.dev/reference/react-dom/client/createRoot React createRoot Documentation}
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)