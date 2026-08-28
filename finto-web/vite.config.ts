import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The typed client lives with the backend so both apps share one source
      // of truth for request shapes.
      '@finto/api-client': fileURLToPath(
        new URL('../finto-backend/packages/api-client/src/index.ts', import.meta.url)
      )
    }
  },
  server: { port: 5173, strictPort: false }
});
