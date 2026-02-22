import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // Disable DTS generation in tsup, use tsc instead
  clean: true,
  sourcemap: true,
  target: 'es2022',
  external: ['react', 'react-dom', '@synnel/client-v2'],
})
