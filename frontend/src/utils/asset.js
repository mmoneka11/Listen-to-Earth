// Resolve a public asset path under the app's deploy base (works at "/" or "/Listen-to-Earth/").
export function asset(path) {
  const base = import.meta.env.BASE_URL || '/';
  return base.replace(/\/+$/, '/') + String(path).replace(/^\/+/, '');
}
