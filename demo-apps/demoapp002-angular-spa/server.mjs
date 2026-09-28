// Serves the built SPA and proxies /api to the Node service, so the browser talks to one origin
// (DR-014): no CORS, and the session cookie is first-party. SPA routes fall back to index.html.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./dist/browser/', import.meta.url));
const api = process.env.LOP_API_URL ?? 'http://127.0.0.1:8000';
const port = Number(process.env.PORT ?? 4200);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const FORWARD = ['content-type', 'cookie', 'x-test-namespace'];

async function proxy(req, res) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = Object.fromEntries(FORWARD.filter((h) => req.headers[h]).map((h) => [h, String(req.headers[h])]));
    const upstream = await fetch(api + req.url, {
        method: req.method,
        headers,
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
    const out = { 'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream' };
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) out['set-cookie'] = cookies;
    res.writeHead(upstream.status, out);
    res.end(Buffer.from(await upstream.arrayBuffer()));
}

function serveStatic(req, res) {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    let file = join(root, path);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
}

createServer((req, res) => {
    const handler = req.url.startsWith('/api/') || req.url === '/health' ? proxy : serveStatic;
    Promise.resolve(handler(req, res)).catch((error) => {
        console.error(error);
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
        res.end('Bad gateway');
    });
}).listen(port, () => console.log(`demoapp002-angular-spa on :${port}, API ${api}`));
