import 'regenerator-runtime/runtime';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { browserMockApi } from './browserMockApi';

// Inject browser mock API if running in a standalone web browser (Spec 38/63 fallback)
if (typeof window !== 'undefined' && !(window as any).api) {
  console.warn('Electron IPC API not detected. Injecting web browser fallback layer.');
  (window as any).api = browserMockApi as any;
}

import { SocietyProvider } from './context/SocietyContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SocietyProvider>
      <App />
    </SocietyProvider>
  </React.StrictMode>
);
