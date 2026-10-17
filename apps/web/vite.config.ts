import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Build output goes to apps/web/dist; apps/worker/wrangler.jsonc serves it as static assets.
// `--mode e2e` (pnpm build:e2e) compiles in the E2E-only hooks (VITE_E2E=1); every other mode
// replaces the flag with '' so the hook code is dead and stripped (proven by no-e2e-hook-in-dist).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_E2E': JSON.stringify(mode === 'e2e' ? '1' : ''),
    // G16 runtime API base default: '' for the preview bundle (no Worker: the AI lane fails soft),
    // '/' (same origin) for every other mode (production, the stack bundle, vitest `test`).
    'import.meta.env.VITE_API_BASE': JSON.stringify(mode === 'e2e' ? '' : '/'),
  },
  worker: { format: 'es' as const },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // CSP font-src 'self' (Phase 10 D2): never inline fonts as data: URIs; other assets keep the default.
    assetsInlineLimit: (file: string) =>
      /\.(woff2?|ttf|otf|eot)$/i.test(file) ? false : undefined,
  },
  preview: { host: '127.0.0.1' },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
}));
