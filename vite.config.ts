import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Validate environment variables in production
const isProduction = process.env.NODE_ENV === 'production'
const apiBaseUrl = process.env.VITE_API_BASE_URL || '/api'

// Proxy target for dev server (default: localhost:8069)
// Set VITE_PROXY_TARGET to point to remote backend if needed
// Examples:
//   - Local: http://localhost:8069
//   - Remote: https://qacc.erpth.net
//   - Remote with port: http://192.168.1.100:18069
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:8069'

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
        target: proxyTarget,
        changeOrigin: true,
        // Only proxy if target is not localhost (for remote backends)
        ...(proxyTarget.includes('localhost') || proxyTarget.includes('127.0.0.1')
          ? {}
          : {
              secure: false, // Allow self-signed certs for remote dev
              ws: true, // WebSocket support
            }),
      },
    },
  },
})