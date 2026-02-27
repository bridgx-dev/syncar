import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  // Generate bundled type declarations
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2020',
  // Only externalize peer dependencies
  // lib and types are BUNDLED, not external
  external: ['ws'],
  // Bundle everything (JS and types)
  bundle: true,
  // Don't split code - keep it as one file
  splitting: false,
})
