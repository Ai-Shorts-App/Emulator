const dns = require('node:dns').promises;
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT) || 4173;
const maxResponseBytes = 15 * 1024 * 1024;
const blockedHeaders = new Set(['content-security-policy', 'content-security-policy-report-only', 'x-frame-options', 'frame-options']);

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const parts = address.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
  }
  return address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:');
}

async function assertPublicTarget(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS targets are supported.');
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('Private network targets are blocked.');
}

function targetFromRequest(requestUrl) {
  const target = new URL(requestUrl, `http://127.0.0.1:${port}`);
  const value = target.searchParams.get('url');
  if (!value) throw new Error('Missing url parameter.');
  return new URL(value);
}

async function readResponse(response) {
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxResponseBytes) throw new Error('The response is too large.');
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function proxy(request, response) {
  let target = targetFromRequest(request.url);
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    await assertPublicTarget(target);
    const upstream = await fetch(target, { redirect: 'manual', headers: { 'user-agent': 'OrbitBrowser/1.0' } });
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get('location');
      if (!location || redirect === 5) throw new Error('Too many redirects.');
      target = new URL(location, target);
      continue;
    }
    const body = await readResponse(upstream);
    const headers = {};
    for (const [name, value] of upstream.headers) if (!blockedHeaders.has(name.toLowerCase())) headers[name] = value;
    headers['access-control-allow-origin'] = 'http://127.0.0.1:' + port;
    response.writeHead(upstream.status, headers);
    response.end(body);
    return;
  }
}

function serveStatic(request, response) {
  const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, requested === '/' ? 'index.html' : `.${requested}`);
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200);
  fs.createReadStream(file).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith('/proxy?')) await proxy(request, response);
    else serveStatic(request, response);
  } catch (error) {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error.message);
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Orbit Browser running at http://127.0.0.1:${port}`));