import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    exclude: ['node_modules', 'dist'],
    root: './',
  },
  resolve: {
    alias: {
      '@synnel/server': path.resolve(__dirname, './src'),
      '@synnel/core': path.resolve(__dirname, '../core/src'),
    },
  },
})
