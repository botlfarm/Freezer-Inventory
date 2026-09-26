import path from 'node:path';
import fs from 'node:fs';
import module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Polyfill/patch createRequire for Node 22 compatibility where relative path '.' causes ERR_INVALID_ARG_VALUE in vite-plugin-pwa
if (module.createRequire) {
  const originalCreateRequire = module.createRequire;
  module.createRequire = function (filename) {
    if (typeof filename === 'string' && !path.isAbsolute(filename) && !filename.startsWith('file://')) {
      filename = path.resolve(process.cwd(), filename);
    }
    return originalCreateRequire.call(this, filename);
  };
}

const currentFileUrl = typeof import.meta !== 'undefined' ? import.meta?.url : null;
const currentFilename = currentFileUrl ? fileURLToPath(currentFileUrl) : process.cwd();
const currentDirname = currentFileUrl ? path.dirname(currentFilename) : process.cwd();
const require = currentFileUrl ? createRequire(currentFileUrl) : createRequire(path.join(process.cwd(), 'package.json'));

const distServer = path.join(process.cwd(), 'dist', 'server.cjs');
const subDistServer = path.join(process.cwd(), 'freezer_inventory_tracker', 'dist', 'server.cjs');
const localServer = path.join(process.cwd(), 'freezer_inventory_tracker', 'server.ts');

if (fs.existsSync(distServer)) {
  require(distServer);
} else if (fs.existsSync(subDistServer)) {
  require(subDistServer);
} else if (fs.existsSync(localServer)) {
  try {
    require('tsx/cjs');
    require(localServer);
  } catch (e) {
    const esbuild = require('esbuild');
    const outfile = path.join(process.cwd(), 'node_modules', '.cache', 'temp_server.cjs');
    esbuild.buildSync({
      entryPoints: [localServer],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['better-sqlite3'],
      outfile: outfile,
    });
    require(outfile);
  }
} else {
  console.error('Server file not found.');
  process.exit(1);
}
