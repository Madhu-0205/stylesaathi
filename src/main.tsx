import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { WardrobeProvider } from './context/WardrobeContext';
import { WeatherProvider } from './context/WeatherContext';
import { App } from './App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <WardrobeProvider>
          <WeatherProvider>
            <App />
          </WeatherProvider>
        </WardrobeProvider>
      </AuthProvider>
    </React.StrictMode>
  );
}
