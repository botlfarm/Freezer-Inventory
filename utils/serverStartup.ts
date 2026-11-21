export interface ServerListenOptions {
  port: number;
  host: string;
}

export type ExpressMiddlewareFn = (req: any, res: any, next: (err?: any) => void) => any;

function isValidPort(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const parsed = Number(raw.trim());
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : null;
}

export function parseServerListenArgs(
  argv: string[] = [],
  env: Record<string, string | undefined> = {}
): ServerListenOptions {
  let port = 3000;
  let host = '0.0.0.0';

  const npmConfigPort = isValidPort(env.npm_config_port);
  if (npmConfigPort !== null) {
    port = npmConfigPort;
  }
  if (env.npm_config_host && env.npm_config_host.trim()) {
    host = env.npm_config_host.trim();
  }

  const envPort = isValidPort(env.PORT);
  if (envPort !== null) {
    port = envPort;
  }

  if (env.HOST && env.HOST.trim()) {
    host = env.HOST.trim();
  }

  const positionalArgs: string[] = [];
  let hasExplicitPortFlag = false;
  let hasExplicitHostFlag = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' && i + 1 < argv.length) {
      hasExplicitPortFlag = true;
      const parsed = isValidPort(argv[++i]);
      if (parsed !== null) {
        port = parsed;
      }
    } else if (arg.startsWith('--port=')) {
      hasExplicitPortFlag = true;
      const parsed = isValidPort(arg.slice('--port='.length));
      if (parsed !== null) {
        port = parsed;
      }
    } else if (arg === '--host' && i + 1 < argv.length) {
      hasExplicitHostFlag = true;
      const nextHost = argv[++i]?.trim();
      if (nextHost) {
        host = nextHost;
      }
    } else if (arg.startsWith('--host=')) {
      hasExplicitHostFlag = true;
      const nextHost = arg.slice('--host='.length).trim();
      if (nextHost) {
        host = nextHost;
      }
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    }
  }

  // Handle npm stripping `--port` / `--host` flags into positional arguments (`npm run dev --port 3000 --host 0.0.0.0`)
  for (const pos of positionalArgs) {
    const posPort = isValidPort(pos);
    if (posPort !== null && !hasExplicitPortFlag && envPort === null) {
      port = posPort;
      continue;
    }
    if (pos.trim() && !/^\d+$/.test(pos.trim()) && !hasExplicitHostFlag && !(env.HOST && env.HOST.trim())) {
      host = pos.trim();
    }
  }

  return { port, host };
}

export function createDeferredViteMiddleware(
  viteMiddlewarePromise: Promise<ExpressMiddlewareFn>
): ExpressMiddlewareFn {
  let resolvedMiddleware: ExpressMiddlewareFn | null = null;
  let initError: unknown = null;

  const readyPromise = viteMiddlewarePromise
    .then((mw) => {
      resolvedMiddleware = mw;
      return mw;
    })
    .catch((err) => {
      initError = err instanceof Error ? err : new Error(String(err));
      throw initError;
    });

  // Prevent unhandled rejection warning if initialization fails before any request arrives
  readyPromise.catch(() => {});

  return async function deferredViteHandler(req: any, res: any, next: (err?: any) => void) {
    if (resolvedMiddleware) {
      return resolvedMiddleware(req, res, next);
    }
    if (initError) {
      return next(initError);
    }
    try {
      const mw = await readyPromise;
      return mw(req, res, next);
    } catch (err) {
      return next(err);
    }
  };
}
