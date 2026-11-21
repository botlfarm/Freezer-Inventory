import { describe, it, expect, vi } from 'vitest';
import { createDeferredViteMiddleware, parseServerListenArgs } from '../utils/serverStartup';

describe('Server Startup Helpers', () => {
  describe('parseServerListenArgs', () => {
    it('defaults to port 3000 and host 0.0.0.0', () => {
      expect(parseServerListenArgs([], {})).toEqual({ port: 3000, host: '0.0.0.0' });
    });

    it('parses --port and --host space-separated and equals-separated CLI flags', () => {
      expect(parseServerListenArgs(['--port', '3000', '--host', '0.0.0.0'], {})).toEqual({
        port: 3000,
        host: '0.0.0.0',
      });
      expect(parseServerListenArgs(['--port=4500', '--host=127.0.0.1'], {})).toEqual({
        port: 4500,
        host: '127.0.0.1',
      });
    });

    it('uses PORT and HOST environment variables and prioritizes explicit CLI flags', () => {
      expect(parseServerListenArgs([], { PORT: '8080', HOST: '127.0.0.1' })).toEqual({
        port: 8080,
        host: '127.0.0.1',
      });
      expect(parseServerListenArgs(['--port', '3000'], { PORT: '8080', HOST: '127.0.0.1' })).toEqual({
        port: 3000,
        host: '127.0.0.1',
      });
    });

    it('ignores invalid port numbers and empty host strings', () => {
      expect(parseServerListenArgs(['--port', 'notanumber', '--host', '   '], { PORT: '-5' })).toEqual({
        port: 3000,
        host: '0.0.0.0',
      });
    });

    it('supports npm_config_port/npm_config_host and positional args when npm run dev omits --', () => {
      expect(parseServerListenArgs(['3098', '127.0.0.1'], {})).toEqual({
        port: 3098,
        host: '127.0.0.1',
      });
      expect(
        parseServerListenArgs([], { npm_config_port: '3100', npm_config_host: '127.0.0.1' })
      ).toEqual({
        port: 3100,
        host: '127.0.0.1',
      });
      expect(
        parseServerListenArgs(['--port', '4000'], { npm_config_port: '3100', PORT: '8080' })
      ).toEqual({
        port: 4000,
        host: '0.0.0.0',
      });
    });
  });

  describe('createDeferredViteMiddleware', () => {
    it('waits for pending Vite middleware and delegates requests once ready', async () => {
      let resolveVite!: (mw: (req: any, res: any, next: () => void) => void) => void;
      const vitePromise = new Promise<(req: any, res: any, next: () => void) => void>((resolve) => {
        resolveVite = resolve;
      });

      const wrapper = createDeferredViteMiddleware(vitePromise);
      const mockMw = vi.fn((_req, res) => {
        res.status = 200;
      });

      const req = { url: '/' };
      const res: any = {};
      const next = vi.fn();

      const pendingCall = wrapper(req, res, next);
      expect(mockMw).not.toHaveBeenCalled();

      resolveVite(mockMw);
      await pendingCall;

      expect(mockMw).toHaveBeenCalledTimes(1);
      expect(mockMw).toHaveBeenCalledWith(req, res, next);
      expect(res.status).toBe(200);

      // Subsequent requests invoke resolved middleware synchronously without awaiting
      const res2: any = {};
      wrapper(req, res2, next);
      expect(mockMw).toHaveBeenCalledTimes(2);
      expect(res2.status).toBe(200);
    });

    it('forwards Vite initialization errors to Express next(err)', async () => {
      const boom = new Error('Vite failed to initialize');
      const wrapper = createDeferredViteMiddleware(Promise.reject(boom));
      const next = vi.fn();

      await wrapper({ url: '/' }, {}, next);
      expect(next).toHaveBeenCalledWith(boom);

      // Subsequent requests also immediately forward the cached init error
      const next2 = vi.fn();
      await wrapper({ url: '/' }, {}, next2);
      expect(next2).toHaveBeenCalledWith(boom);
    });
  });
});
