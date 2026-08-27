'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { ROOT } = require('../src/lib/config.cjs');

const root = path.join(ROOT, 'dist');
const port = Number(process.env.PORT || 8787);
const host = String(process.env.HOST || '127.0.0.1');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

if (!fs.existsSync(path.join(root, 'index.html'))) {
  throw new Error('dist 不存在。先运行 npm run demo 和 npm run build');
}

const server = http.createServer((request, response) => {
  const raw = decodeURIComponent(String(request.url || '/').split('?')[0]);
  const relative = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');
  const filePath = path.resolve(root, relative);
  if (!filePath.startsWith(`${path.resolve(root)}${path.sep}`) && filePath !== path.resolve(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not Found' : 'Server Error');
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(content);
  });
});

server.listen(port, host, () => {
  process.stdout.write(`preview http://${host === '0.0.0.0' ? '<本机局域网IP>' : host}:${port}\n`);
});
