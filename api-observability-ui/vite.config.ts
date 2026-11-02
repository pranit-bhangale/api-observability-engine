import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: path.resolve(import.meta.dirname, 'src/main/resources/static/obs'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/obs/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/obs/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
