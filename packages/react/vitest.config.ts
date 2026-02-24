import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist'],
    root: './',
  },
  resolve: {
    alias: {
      '@synnel/react': path.resolve(__dirname, './src'),
      '@synnel/client': path.resolve(__dirname, '../client/src'),
      '@synnel/core': path.resolve(__dirname, '../core/src'),
    },
  },
})
