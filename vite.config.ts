import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Validate environment variables in production
const isProduction = process.env.NODE_ENV === 'production'
const apiBaseUrl = process.env.VITE_API_BASE_URL || '/api'

if (isProduction && apiBaseUrl.startsWith('/')) {
  console.warn('⚠️  Warning: VITE_API_BASE_URL is relative in production mode.')
  console.warn('   This may cause connection issues. Use full URL (e.g., https://api.example.com)')
  console.warn('   Run: npm run setup:prod to configure properly\n')
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