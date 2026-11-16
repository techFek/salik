// Builds the side-panel page from the standalone Studio (src/Salik_studio.html):
//   studio.html  — the markup, with scripts as files (extension pages forbid inline / remote scripts)
//   studio.js    — Studio's inline script
// Run: node studio-extension/build.mjs   (after replacing src/Salik_studio.html with a newer Studio)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
let html = readFileSync(join(dir, 'src', 'Salik_studio.html'), 'utf8');

const inline = [];
html = html.replace(/<script>([\s\S]*?)<\/script>/g, (_, code) => { inline.push(code); return ''; });
if(!inline.length) throw new Error('No inline <script> found in Salik_studio.html');

html = html.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/[^"]+"><\/script>/, '<script src="vendor/xlsx.full.min.js"></script>');
if(/<script src="https?:/.test(html)) throw new Error('A remote <script> is left; extension pages cannot load it.');

let js = inline.join('\n;\n');
// The audio alignment loads transformers.js from a CDN, which an extension page is not allowed to do.
js = js.replace(/await import\(ALIGN_LIB\)/g,
  "(() => { throw new Error('Audio alignment does not run inside the extension: open the standalone Salik_studio.html for it.'); })()");

html = html.replace('</head>', '<link rel="stylesheet" href="panel.css">\n</head>');
html = html.replace('</body>', '<script src="storage-shim.js"></script>\n<script src="studio.js"></script>\n</body>');
writeFileSync(join(dir, 'studio.html'), html);
writeFileSync(join(dir, 'studio.js'), js);
console.log(`studio.html ${html.length} bytes, studio.js ${js.length} bytes (${inline.length} inline script${inline.length > 1 ? 's' : ''})`);
