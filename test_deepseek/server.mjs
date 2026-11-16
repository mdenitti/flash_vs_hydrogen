import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
};

const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        let pathname = decodeURIComponent(url.pathname);

        if (pathname.endsWith('/')) pathname += 'index.html';

        // Resolve inside ROOT only (prevents path traversal)
        const filePath = resolve(join(ROOT, normalize(pathname)));
        if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
            res.writeHead(403).end('Forbidden');
            return;
        }

        const info = await stat(filePath).catch(() => null);
        if (!info || !info.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
            return;
        }

        const body = await readFile(filePath);
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-cache',
        }).end(req.method === 'HEAD' ? undefined : body);
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Server error');
        console.error(err);
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Globe app running at http://localhost:${PORT}`);
});
