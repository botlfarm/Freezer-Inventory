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

/**
 * Executes a fetch request with automatic retries, exponential backoff, and timeout guards
 * for resilient network communications in mobile, Home Assistant Ingress, and cloud environments.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  delayMs = 300,
  timeoutMs = 12000
): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    let timeoutTriggered = false;
    const timeoutId = setTimeout(() => {
      timeoutTriggered = true;
      try {
        controller.abort();
      } catch (e) {}
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal
      });
      clearTimeout(timeoutId);

      // If server returned transient 502/503/504 gateway or 429 rate limit, retry with backoff
      if ((response.status === 502 || response.status === 503 || response.status === 504 || response.status === 429) && attempt < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      // If user aborted explicitly (outside of our internal timeout guard), stop retrying
      if (err.name === 'AbortError' && !timeoutTriggered && options.signal?.aborted) {
        throw err;
      }
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError || new Error('Network request failed');
}
