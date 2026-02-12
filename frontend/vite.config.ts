import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8000',
      '/accounts': 'http://localhost:8000',
      '/admin': 'http://localhost:8000',
      '/a': {
        target: 'http://localhost:8000',
        bypass(req) {
          // Only proxy /a/{id}/info|tree|resolve|download|splits|rows to Django
          // Everything else (e.g., /a/{id}/) is served by React SPA
          if (req.url && /\/a\/[^/]+\/(info|tree|resolve|download)(\/|$|\?)/.test(req.url)) {
            return undefined
          }
          return '/index.html'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
})
