import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configura el servidor de desarrollo.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // VITE_API_PROXY permite apuntar a otro backend (por ejemplo, el de las pruebas en navegador).
    proxy: { '/api': process.env.VITE_API_PROXY || 'http://localhost:3001' },
  },
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes('commonjsHelpers.js')) return 'vendor-react';
          if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (/\/node_modules\/(motion|motion-dom|motion-utils|framer-motion)\//.test(id)) return 'vendor-motion';
          if (id.includes('/node_modules/@react-spring/')) return 'vendor-spring';
          if (/\/node_modules\/(gsap|@gsap)\//.test(id)) return 'vendor-gsap';
        },
      },
    },
  },
  // Pruebas de componentes con un DOM simulado; no usan el backend.
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['tests/setup.js'],
  },
});
