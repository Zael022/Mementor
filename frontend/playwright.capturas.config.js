import base from './playwright.config.js';

// Configuración para generar las capturas de los mockups (escritorio y móvil) sin correr la suite e2e.
export default {
  ...base,
  testDir: './capturas',
  retries: 0,
  reporter: 'list',
  projects: [
    { ...base.projects[0], name: 'escritorio', use: { ...base.projects[0].use, viewport: { width: 1440, height: 900 } } },
    { ...base.projects[1], name: 'movil', grep: undefined },
  ],
};
