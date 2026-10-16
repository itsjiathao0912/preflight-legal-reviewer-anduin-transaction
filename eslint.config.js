import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.wrangler/**',
      '**/node_modules/**',
      'process/**',
      'docs/**',
      'design/**',
      'samples/**',
      '.claude/**',
      '.codex/**',
      '.agents/**',
      '.vibecode-backup*/**',
      'playwright-report/**',
      'test-results/**',
      'apps/worker/worker-configuration.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // core must run in Workers, Node and Web Workers: no DOM globals (Phase 01 F0)
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'document',
          message: 'packages/core must not use the DOM (runs in Workers/Node/Web Workers).',
        },
        {
          name: 'window',
          message: 'packages/core must not use window (runs in Workers/Node/Web Workers).',
        },
      ],
    },
  },
);
