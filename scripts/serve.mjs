// Minimal static file server for local development.
//
// It exists instead of `python -m http.server` because Python on Windows takes MIME
// types from the registry, which often maps .js to text/plain, and browsers refuse
// to run module scripts served that way. Here the map is explicit.
//
// Usage: node scripts/serve.mjs [--port 8095] [--host 127.0.0.1]

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const port = Number(arg('port', process.env.PORT || 8095));
const host = arg('host', '127.0.0.1');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    // Refuse anything that resolves outside the project folder.
    if (file !== root && !file.startsWith(root + sep)) throw Object.assign(new Error(), { code: 'ENOENT' });
    if ((await stat(file)).isDirectory()) {
      res.writeHead(301, { Location: path + '/' }).end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (err) {
    const missing = err.code === 'ENOENT' || err.code === 'ENOTDIR';
    res.writeHead(missing ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(missing ? 'Not found' : 'Server error');
  }
}).listen(port, host, () => {
  console.log(`music-trainer: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
});
