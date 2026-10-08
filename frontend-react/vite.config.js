import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
