import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import App from './App.jsx';
import ColorModeProvider from './theme/ColorMode.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ColorModeProvider>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} autoHideDuration={3000} anchorOrigin={{ vertical:'bottom', horizontal:'right' }}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SnackbarProvider>
    </ColorModeProvider>
  </React.StrictMode>
);
