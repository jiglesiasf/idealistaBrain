import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/core/__tests__/**/*.test.cjs'],
  },
});
