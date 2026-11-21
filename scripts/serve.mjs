// Tiny static server for the test games: http://localhost:5174/<game>/
// Serves games/ and maps /vendor/phaser.js to the installed Phaser build. The app server also serves the
// same files under /play/ (src/server.mjs), so people can play them from the app's own address.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const gamesDir = join(root, 'games');
const vendor = {
  '/vendor/phaser.js': join(root, 'node_modules', 'phaser', 'dist', 'phaser.min.js'),
};
export const GAME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** The file behind a games URL path ("/gap-run/", "/vendor/phaser.js"), or an error with code 403/404. */
export async function gameFile(pathname) {
  let file = vendor[pathname];
  if (!file) {
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      throw Object.assign(new Error('not found'), { code: 404 });
    }
    const rel = normalize(decoded).replace(/^([/\\])+/, '');
    file = join(gamesDir, rel);
    if (file !== gamesDir && !file.startsWith(gamesDir + sep)) throw Object.assign(new Error('forbidden'), { code: 403 });
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
  }
  return file;
}

export function startServer(port = Number(process.env.PORT) || 5174) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const file = await gameFile(url.pathname);
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': GAME_TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch (err) {
      res.writeHead(err.code === 403 ? 403 : 404, { 'content-type': 'text/plain' });
      res.end(err.code === 403 ? 'Forbidden' : 'Not found');
    }
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, () => ok(server));
  });
}

/** Starts the games server unless one is already listening on that port. Returns a closable handle. */
export async function ensureGamesServer(port = 5174) {
  try {
    const server = await startServer(port);
    return { port, close: () => server.close() };
  } catch (err) {
    if (err.code !== 'EADDRINUSE') throw err;
    return { port, close: () => {} };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startServer();
  console.log(`Test games on http://localhost:${server.address().port}/`);
}
