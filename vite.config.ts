import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env, .env.local, .env.[mode], .env.[mode].local
  const env = loadEnv(mode, process.cwd(), '')

  const isProduction = mode === 'production'
  const apiBaseUrl = env.VITE_API_BASE_URL || '/api'

  // Proxy target for dev server (default: localhost:8069)
  // Set VITE_PROXY_TARGET to point to remote backend if needed
  // Examples:
  //   - Local: http://localhost:8069
  //   - Remote: https://qacc.erpth.net
  //   - Remote with port: http://192.168.1.100:18069
  const proxyTargetRaw = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8069'
  const proxyTarget = proxyTargetRaw.replace(/\/+$/, '')
  // Local topology can vary. Keep /api and /web on root backend by default,
  // and preserve /odoo proxy for deployments exposing web client under /odoo.
  const apiProxyTarget = proxyTarget.replace(/\/odoo$/i, '')
  const webProxyTarget = apiProxyTarget

  // Relative path is OK in production if using nginx proxy
  // Only warn if it's not /api (which is the standard proxy path)
  if (isProduction && apiBaseUrl.startsWith('/') && apiBaseUrl !== '/api') {
    console.warn('⚠️  Warning: VITE_API_BASE_URL is relative in production mode.')
    console.warn('   Make sure nginx proxy is configured to forward requests to backend.\n')
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          // Only proxy if target is not localhost (for remote backends)
          ...(apiProxyTarget.includes('localhost') || apiProxyTarget.includes('127.0.0.1')
            ? {}
            : {
                secure: false, // Allow self-signed certs for remote dev
                ws: true, // WebSocket support
              }),
        },
        '/web': {
          target: webProxyTarget,
          changeOrigin: true,
          ...(webProxyTarget.includes('localhost') || webProxyTarget.includes('127.0.0.1')
            ? {}
            : {
                secure: false,
                ws: true,
              }),
        },
        '/odoo': {
          target: /\/odoo$/i.test(proxyTarget) ? proxyTarget : `${apiProxyTarget}/odoo`,
          changeOrigin: true,
          ...((/\/odoo$/i.test(proxyTarget) ? proxyTarget : `${apiProxyTarget}/odoo`).includes('localhost') || (/\/odoo$/i.test(proxyTarget) ? proxyTarget : `${apiProxyTarget}/odoo`).includes('127.0.0.1')
            ? {}
            : {
                secure: false,
                ws: true,
              }),
        },
      },
    },
  }
})
