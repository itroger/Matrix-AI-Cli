import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  target: 'es2022',
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  platform: 'node',
})
