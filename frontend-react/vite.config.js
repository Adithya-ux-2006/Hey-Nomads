import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Everything in one 537 kB chunk meant the whole app downloaded before any
    // page could render. Splitting the heavy, rarely-changing libraries out
    // lets the browser cache them across deploys and cuts first paint.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // React and its router change with our deploys; the rest is stable
          // third-party code that a cached copy stays good for.
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) {
            return 'react'
          }
          if (id.includes('framer-motion') || id.includes('node_modules/motion')) return 'motion'
          if (id.includes('lucide-react')) return 'icons'
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    // Matches LOCAL_API_PORT in scripts/local-api.mjs. The old :3000 target was
    // the retired MySQL server's port and nothing listened on it.
    proxy: {
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
    },
  },
})
