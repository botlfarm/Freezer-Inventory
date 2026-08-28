/**
 * Resolves an API path to the correct absolute path depending on the runtime environment.
 * Handles Home Assistant Ingress (by retaining the ingress token/context prefix)
 * as well as standard/standalone environments (AI Studio, Cloud Run, Local development).
 */
export function getApiUrl(path: string): string {
  // Strip any leading slash to normalize the input
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Detect Home Assistant Ingress context in the pathname
  const matchIngress = window.location.pathname.match(/^\/api\/hassio_ingress\/[^/]+\/?/);
  if (matchIngress) {
    const base = matchIngress[0].endsWith('/') ? matchIngress[0] : `${matchIngress[0]}/`;
    return `${base}${cleanPath}`;
  }

  // Standalone environments
  return `/${cleanPath}`;
}
