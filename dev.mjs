import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const portArg = process.argv.indexOf('--port');
const port = Number(process.env.PORT || (portArg >= 0 && process.argv[portArg + 1]) || (process.env.SITES_MANAGED_LINUX_CONTAINER === '1' ? 4173 : 5173));
const hostArg = process.argv.indexOf('--host');
const host = process.env.HOST || (hostArg >= 0 && process.argv[hostArg + 1]) || (process.env.SITES_MANAGED_LINUX_CONTAINER === '1' ? '0.0.0.0' : '127.0.0.1');
const clients = new Set();
const files = new Set(['index.html', 'app.js', 'data.js', 'icons.js', 'plan-engine.js', 'styles.css']);
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css' };

createServer(async (request, response) => {
  let path;
  try { path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  if (path === '/__reload') {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    response.write(': connected\n\n'); clients.add(response); request.on('close', () => clients.delete(response)); return;
  }
  const file = path === '/' ? 'index.html' : path.slice(1);
  if (!files.has(file)) { response.writeHead(404).end('Not found'); return; }
  try {
    let content = await readFile(join(root, file));
    if (file === 'index.html') content = Buffer.from(content.toString().replace('</body>', '<script>new EventSource("/__reload").onmessage=()=>location.reload()</script></body>'));
    response.writeHead(200, { 'Content-Type': `${types[file.split('.').pop()]}; charset=utf-8`, 'Cache-Control': 'no-store' }); response.end(content);
  } catch { response.writeHead(500).end('Could not read application file'); }
}).listen(port, host, () => console.log(`Money Moves → http://${host}:${port}\nEdit a source file to reload. Ctrl+C to stop.`));
let debounce;
watch(root, (_, file) => { if (!files.has(file)) return; clearTimeout(debounce); debounce=setTimeout(()=>clients.forEach(client=>client.write('data: reload\n\n')),80); });
