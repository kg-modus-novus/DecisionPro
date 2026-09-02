import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { DemoLoginGate } from './components/DemoLoginGate.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DemoLoginGate>
      <App />
    </DemoLoginGate>
  </React.StrictMode>,
);
