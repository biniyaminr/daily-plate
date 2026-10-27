// Browser-test server: serves the real pages and the real API handler with an
// in-memory compare-and-swap store, signed in as a fixed test user. Lets the
// frontend (saving, conflicts, offline, import) be exercised in a browser
// without a Supabase project.
//   node --experimental-strip-types tests/e2e/local-server.mjs [port]
// Test hooks: POST /__test/session?user=<id|none>, POST /__test/down?on=1|0
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getProgress, putProgress, validateBackup } from '../../lib/progress/handler.ts';

const root = path.resolve(import.meta.dirname, '../..');
const port = Number(process.argv[2] ?? 3322);
const db = new Map(); // `${user}:${kind}` -> { payload, revision }
let sessionUser = '00000000-0000-4000-8000-0000000000be';
let down = false;

const store = (user) => ({
  async list() {
    if (down) throw new Error('down');
    return [...db.entries()].filter(([k]) => k.startsWith(`${user}:`)).map(([k, v]) => ({ kind: k.split(':')[1], payload: structuredClone(v.payload), revision: v.revision }));
  },
  async save(kind, expected, payload) {
    if (down) throw new Error('down');
    const key = `${user}:${kind}`;
    const row = db.get(key);
    if ((row?.revision ?? 0) !== expected) return null;
    db.set(key, { payload: structuredClone(payload), revision: expected + 1 });
    return expected + 1;
  },
});
const deps = () => ({ getUserId: async () => sessionUser, store: store(sessionUser) });
const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8' };

async function toWeb(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
}

async function send(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    if (url.pathname === '/__test/session') {
      sessionUser = url.searchParams.get('user') === 'none' ? null : url.searchParams.get('user');
      return res.end('ok');
    }
    if (url.pathname === '/__test/down') {
      down = url.searchParams.get('on') === '1';
      return res.end('ok');
    }
    if (url.pathname === '/__test/db') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(Object.fromEntries(db)));
    }
    if (url.pathname === '/api/progress') {
      return send(res, req.method === 'GET' ? await getProgress(deps()) : await putProgress(await toWeb(req), deps()));
    }
    if (url.pathname === '/api/progress/validate') return send(res, await validateBackup(await toWeb(req), deps()));
    if (url.pathname === '/app' || url.pathname === '/app/nutrition') {
      const file = url.pathname === '/app' ? 'index.html' : 'nutrition.html';
      const html = (await readFile(path.join(root, 'shell', file), 'utf8')).replace(
        '</head>',
        `<meta name="plate-user" content="00000000-0000-4000-8000-0000000000be"><meta name="plate-email" content="benji@test.local"></head>`,
      );
      res.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (url.pathname.startsWith('/plate/') || ['/favicon.svg', '/logo.svg'].includes(url.pathname)) {
      const file = path.join(root, 'public', path.normalize(url.pathname));
      if (!file.startsWith(path.join(root, 'public'))) throw new Error('bad path');
      res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
      return res.end(await readFile(file));
    }
    if (url.pathname === '/auth/signout' || url.pathname === '/login') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end(`stub ${url.pathname}`);
    }
    res.writeHead(404).end('not found');
  } catch {
    res.writeHead(500).end('error');
  }
}).listen(port, () => console.log(`test server on http://localhost:${port}`));
