import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './lib/auth';
import { LiveProvider } from './lib/live';
import { ToastProvider } from './lib/toast';
import './styles/tokens.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LiveProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </LiveProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
