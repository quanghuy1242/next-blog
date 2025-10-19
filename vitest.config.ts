import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: path.resolve(__dirname, 'setupTests.ts'),
    passWithNoTests: true,
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      common: path.resolve(__dirname, 'common'),
      components: path.resolve(__dirname, 'components'),
      context: path.resolve(__dirname, 'context'),
      pages: path.resolve(__dirname, 'pages'),
      styles: path.resolve(__dirname, 'styles'),
      types: path.resolve(__dirname, 'types'),
    },
  },
});
