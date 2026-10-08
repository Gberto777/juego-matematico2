import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Ruta del repositorio en GitHub Pages: https://<usuario>.github.io/juego-matematico/
  base: '/juego-matematico2/',
  plugins: [react(), tailwindcss()],
})
