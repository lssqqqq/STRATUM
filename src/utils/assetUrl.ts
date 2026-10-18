/**
 * Путь к статическому файлу из public/ с учётом `base` из vite.config.ts.
 *
 *   assetUrl('/assets/logo.svg')
 *     -> '/assets/logo.svg'               (сайт в корне домена)
 *     -> '/stratum/assets/logo.svg'       (сайт на user.github.io/stratum/)
 *
 * Внешние ссылки (http/https), data: и blob: возвращаются как есть.
 */
const BASE: string = (import.meta as any).env?.BASE_URL ?? '/';

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function assetUrl(path: string): string {
  if (!path || EXTERNAL.test(path)) return path;
  if (BASE !== '/' && path.startsWith(BASE)) return path; // уже с префиксом
  return BASE + path.replace(/^\/+/, '');
}

/** Убирает base-префикс, чтобы сравнивать пути независимо от места размещения сайта. */
export function stripBase(path: string): string {
  if (BASE !== '/' && path.startsWith(BASE)) return '/' + path.slice(BASE.length);
  return path;
}
