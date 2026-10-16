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
);
