import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    'process.env.IS_PREACT': JSON.stringify('true'),
  },
  optimizeDeps: {
    include: ['@excalidraw/excalidraw'],
    esbuildOptions: { target: 'es2022' },
  },
  build: {
    target: 'es2022',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['orchestrator-devbox.danhoek.dev', 'dev-orchestrator-devbox.danhoek.dev'],
    proxy: {
      '/api': { target: 'http://localhost:3002', changeOrigin: true },
    },
  },
})
