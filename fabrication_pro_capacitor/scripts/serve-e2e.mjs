import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../www/', import.meta.url)));
const host = '127.0.0.1';
const port = 4173;

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
]);

const server = createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', `http://${host}:${port}`).pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Bad request');
    return;
  }

  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(root + sep)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('Forbidden');
    return;
  }

  try {
    if (!statSync(target).isFile()) throw new Error('not a file');
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }

  const type = mimeTypes.get(extname(target).toLowerCase()) || 'application/octet-stream';
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-store',
  });
  createReadStream(target).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Fabri-Cadabra E2E server listening at http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
