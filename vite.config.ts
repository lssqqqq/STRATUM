import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

/**
 * `base` — путь, по которому сайт открывается.
 *   - Корень домена (user.github.io, свой домен, локальная разработка): '/'
 *   - Репозиторий на GitHub Pages (user.github.io/repo/):               '/repo/'
 *
 * Задаётся переменной VITE_BASE. В GitHub Actions workflow считает её сам
 * по названию репозитория (см. .github/workflows/deploy.yml).
 */
function normalizeBase(value: string | undefined): string {
  if (!value || value === '/') return '/';
  let b = value.trim();
  if (!b.startsWith('/')) b = '/' + b;
  if (!b.endsWith('/')) b += '/';
  return b;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const base = normalizeBase(process.env.VITE_BASE ?? env.VITE_BASE);

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
