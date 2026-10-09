import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../client/public-dist');
const types = { '.wasm': 'application/wasm', '.mjs': 'text/javascript', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
http.createServer((req, res) => {
  let filename;
  const artifact = new URL(req.url, 'http://test.invalid').pathname.match(/^\/__validation\/([a-f0-9]{64})$/);
  if (artifact) {
    const file = path.resolve(import.meta.dirname, '../.validation/http-artifacts', artifact[1]);
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Content-Length': fs.statSync(file).size });
    fs.createReadStream(file).pipe(res); return;
  }
  try { filename = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test.invalid').pathname)); }
  catch { res.writeHead(400); res.end(); return; }
  if (!filename.startsWith(root + path.sep) && filename !== root) { res.writeHead(403); res.end(); return; }
  if (filename === root) filename = path.join(root, 'index.html');
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404); res.end(); return; }
  // Exercise the Cloudflare CSP locally; never provides a battle API.
  const policy = fs.readFileSync(path.join(root, '_headers'), 'utf8').split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:')).trim().slice('Content-Security-Policy:'.length).trim();
  res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Content-Security-Policy': policy });
  fs.createReadStream(filename).pipe(res);
}).listen(8789, '127.0.0.1');
