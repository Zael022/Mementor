import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import './styles.css';
import { aplicarPreferencias, leerPreferenciasLocales } from './services/preferencias.js';

// Aplica la última apariencia conocida antes de pintar para evitar parpadeos.
aplicarPreferencias(leerPreferenciasLocales() || {});

// Inicia la aplicación de React.
createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>,
);
