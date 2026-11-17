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
  build: {
    // three.js inti memang ±745 KB (±190 KB gzip) dan hanya dimuat untuk Dashboard 3D
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        /*
         * Library dipisah dari kode aplikasi. Saat aplikasi di-update, browser hanya mengunduh ulang
         * chunk aplikasi yang kecil; chunk library tetap dari cache (nama file ber-hash tidak berubah).
         * Hanya three inti & react-three-fiber yang dikelompokkan: loader GLTF dkk. dibiarkan di chunk
         * lazy-nya sendiri agar tidak ikut termuat untuk model bawaan.
         */
        codeSplitting: {
          // Jangan tarik dependensi bersama (zustand, use-sync-external-store) ke grup 3D:
          // itu membuat chunk aplikasi mengimpor chunk three.js sejak awal.
          includeDependenciesRecursively: false,
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'vendor', test: /node_modules[\\/](axios|@tanstack|zustand|use-sync-external-store)[\\/]/, priority: 20 },
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 10 },
            { name: 'r3f', test: /node_modules[\\/](@react-three[\\/]fiber|its-fine|suspend-react|react-use-measure)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
