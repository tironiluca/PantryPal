/// <reference types="vitest" />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig(() => ({
  plugins: [angular()],
  test: {
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Only report on files actually exercised by a test. Scanning every
      // source file (including untested ones) for a 0%-coverage baseline
      // trips up the coverage tool's parser on some Angular class-field
      // syntax, so we skip that broader "all files" scan.
      all: false,
      thresholds: {
        statements: Number(process.env['COVERAGE_THRESHOLD'] ?? 30),
        branches: Number(process.env['COVERAGE_THRESHOLD'] ?? 25),
        functions: Number(process.env['COVERAGE_THRESHOLD'] ?? 35),
        lines: Number(process.env['COVERAGE_THRESHOLD'] ?? 30),
      },
    },
  },
}));
