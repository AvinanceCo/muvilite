/**
 * Entry point.
 *
 * Purpose: mount the application.
 * Inputs:  none
 * Outputs: renders into #root
 * Deps:    react-dom/client, App, index.css
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { applyTheme, getStoredTheme } from './utils/themes.js';

// Paint in the theme this device last saw, before anything renders; the
// branding request corrects it if the operator has since changed it.
applyTheme(getStoredTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
