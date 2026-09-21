const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.xml': 'application/xml; charset=utf-8' };
function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let name;
    try { name = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
    if (name === '/' || name === '/consulting') { res.writeHead(302, { Location: '/consulting/' }).end(); return; }
    if (!name.startsWith('/consulting/')) { res.writeHead(404).end(); return; }
    name = name.slice('/consulting/'.length);
    if (!name || name.endsWith('/')) name += 'index.html';
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep) || name.split('/').some(p => p.startsWith('.'))) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, content) => {
      if (error) { res.writeHead(404).end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }).end(content);
    });
  });
}
module.exports = { createServer };
if (require.main === module) createServer().listen(8765, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:8765/consulting/'));
