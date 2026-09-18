import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Bundling the handler with esbuild during synth is slower than a unit test.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
