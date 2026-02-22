import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@synnel/react-v2': path.resolve(__dirname, './src'),
      '@synnel/client-v2': path.resolve(__dirname, '../client/src'),
      '@synnel/core-v2': path.resolve(__dirname, '../core/src'),
      '@synnel/adapter-ws-v2': path.resolve(__dirname, '../adapter-ws/src'),
    },
  },
})
