import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Register PWA Service Worker for offline-first support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Anugerah Store Service Worker terdaftar dengan scope:', registration.scope);
      })
      .catch((err) => {
        console.warn('Pendaftaran Service Worker gagal:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
