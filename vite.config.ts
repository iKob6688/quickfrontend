import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Validate environment variables in production
const isProduction = process.env.NODE_ENV === 'production'
const apiBaseUrl = process.env.VITE_API_BASE_URL || '/api'

// Relative path is OK in production if using nginx proxy
// Only warn if it's not /api (which is the standard proxy path)
if (isProduction && apiBaseUrl.startsWith('/') && apiBaseUrl !== '/api') {
  console.warn('⚠️  Warning: VITE_API_BASE_URL is relative in production mode.')
  console.warn('   Make sure nginx proxy is configured to forward requests to backend.\n')
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8069',
        changeOrigin: true,
      },
    },
  },
})