import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => {
  const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      proxy: {
        '/api': backendUrl,
        '/accounts': backendUrl,
        '/admin': backendUrl,
        '/a': {
          target: backendUrl,
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
  }
})
