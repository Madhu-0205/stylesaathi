import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { WardrobeProvider } from './context/WardrobeContext';
import { WeatherProvider } from './context/WeatherContext';
import { App } from './App';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { installGlobalErrorHandlers } from './services/globalErrorHandler';

// Initialize sanitized local diagnostics interceptor
installGlobalErrorHandlers();

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AppErrorBoundary>
        <AuthProvider>
          <WardrobeProvider>
            <WeatherProvider>
              <App />
            </WeatherProvider>
          </WardrobeProvider>
        </AuthProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}

