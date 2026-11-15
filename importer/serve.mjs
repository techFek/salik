#!/usr/bin/env node
/*
 * Serves the repo on http://localhost:8788 for the review page (browsers don't load ES modules from file://).
 *   node importer/serve.mjs      then open http://localhost:8788/importer/review.html
 * Only listens on this computer (127.0.0.1) and only serves files inside the repo.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 8788;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = path.normalize(path.join(ROOT, url === "/" ? "/importer/review.html" : url));
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end("not found"); return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log(`Salik importer review: http://localhost:${PORT}/importer/review.html`));
