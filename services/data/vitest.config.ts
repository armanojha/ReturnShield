import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@returnshield/contracts': resolve(__dirname, '../../packages/contracts/src/index.ts'),
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
