import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Request /api/* diteruskan ke Laravel (php artisan serve) agar tidak perlu setting CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
