import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Ruta del repositorio en GitHub Pages: https://<usuario>.github.io/juego-matematico/
  base: '/juego-matematico2/',
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Firebase en su propio chunk: cambia poco, así el navegador lo reutiliza entre versiones de la app.
        codeSplitting: { groups: [{ name: 'firebase', test: /node_modules[\\/]@?firebase/ }] },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  test: {
    // Los tests no deben usar el proyecto real aunque exista .env.local.
    env: { VITE_FIREBASE_PROJECT_ID: '', VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_USE_EMULATORS: '' },
  },
})
