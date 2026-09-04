import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Test config lives here rather than in vite.config.ts: importing defineConfig
// from 'vitest/config' there would re-type the whole build config and reject
// the existing rollup `manualChunks` object form. Vitest prefers this file
// when both are present; the build keeps using vite.config.ts untouched.
export default defineConfig({
  plugins: [react()],
  test: {
    // supabase/functions holds DENO tests (Deno.test, jsr:/https: specifiers).
    // Vitest cannot run them — it was failing 36 files on every `npm test`,
    // which drowned out real failures. They run via `npm run test:deno`.
    // .claude/worktrees holds stale copies of the whole tree, so its tests were
    // being collected and counted twice.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'supabase/functions/**',
      '.claude/worktrees/**',
    ],
  },
});
