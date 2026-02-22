import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@synnel/server-v2': path.resolve(__dirname, './src'),
      '@synnel/core-v2': path.resolve(__dirname, '../core/src'),
      '@synnel/adapter-ws-v2': path.resolve(__dirname, '../adapter-ws/src'),
    },
  },
})
