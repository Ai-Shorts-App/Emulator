const dns = require('node:dns').promises;
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT) || 4173;
const blockedHeaders = new Set(['content-security-policy', 'content-security-policy-report-only', 'x-frame-options', 'frame-options']);
const forwardedRequestHeaders = ['accept', 'accept-language', 'cache-control', 'content-type', 'cookie', 'if-none-match', 'if-modified-since', 'if-range', 'range', 'referer', 'user-agent'];
const hopByHopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

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

function proxyUrl(url) {
  return `/proxy?url=${encodeURIComponent(url.href)}`;
}

function rewriteHtml(body, target) {
  const html = body.toString('utf8');
  return html.replace(/(\b(?:src|href|action|poster|formaction)\s*=\s*["'])([^"']+)(["'])/gi, (match, prefix, value, suffix) => {
    if (/^(?:data:|blob:|javascript:|mailto:|tel:|#)/i.test(value)) return match;
    try { return `${prefix}${proxyUrl(new URL(value, target))}${suffix}`; }
    catch { return match; }
  }).replace(/(\bsrcset\s*=\s*["'])([^"']+)(["'])/gi, (match, prefix, value, suffix) => {
    const rewritten = value.split(',').map(candidate => {
      const parts = candidate.trim().split(/\s+/);
      try { parts[0] = proxyUrl(new URL(parts[0], target)); } catch { /* keep invalid candidate */ }
      return parts.join(' ');
    }).join(', ');
    return `${prefix}${rewritten}${suffix}`;
  });
}

function requestHeaders(request) {
  const headers = {};
  for (const name of forwardedRequestHeaders) if (request.headers[name]) headers[name] = request.headers[name];
  headers['accept-encoding'] = 'identity';
  return headers;
}

async function proxy(request, response) {
  let target = targetFromRequest(request.url);
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    await assertPublicTarget(target);
    const upstream = await fetch(target, { method: request.method, redirect: 'manual', headers: requestHeaders(request), body: ['GET', 'HEAD'].includes(request.method) ? undefined : request });
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get('location');
      if (!location || redirect === 5) throw new Error('Too many redirects.');
      target = new URL(location, target);
      continue;
    }
    const headers = {};
    for (const [name, value] of upstream.headers) {
      const lower = name.toLowerCase();
      if (!blockedHeaders.has(lower) && !hopByHopHeaders.has(lower) && lower !== 'content-length') headers[name] = value;
    }
    if (headers.location) headers.location = proxyUrl(new URL(headers.location, target));
    headers['access-control-allow-origin'] = `http://127.0.0.1:${port}`;
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('text/html') && request.method !== 'HEAD') {
      const body = Buffer.from(await upstream.text());
      const rewritten = rewriteHtml(body, target);
      headers['content-type'] = 'text/html; charset=utf-8';
      headers['content-length'] = Buffer.byteLength(rewritten);
      response.writeHead(upstream.status, headers);
      response.end(rewritten);
      return;
    }
    response.writeHead(upstream.status, headers);
    if (request.method === 'HEAD' || !upstream.body) { response.end(); return; }
    require('node:stream').Readable.fromWeb(upstream.body).pipe(response);
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
  const contentTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
  response.writeHead(200, { 'content-type': contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream' });
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