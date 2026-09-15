# Orbit Browser

A static, GitHub Pages-ready web viewer with embedded preview and direct browser navigation.

## How it works

- **Open directly** opens a site in a real browser tab, so the destination's normal JavaScript, cookies, storage, navigation, and security policies work.
- **Preview here** tries to render the site inside Orbit when the destination permits iframe embedding.
- If the embedded frame stays blank, Orbit offers the direct browser fallback automatically.
- When running locally with `npm start`, **Proxy preview** can display many sites that block iframes by fetching them through the local server.

## Important limitation

No web page can bypass another site's `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` from client-side JavaScript. A proxy could rewrite those headers, but it would be a separate server with serious security, privacy, authentication, and abuse risks. Direct navigation is the reliable workaround for a static GitHub Pages app.

## Publish

Enable **Settings -> Pages -> Deploy from a branch** and select `main` with `/ (root)`.

## Local proxy mode

GitHub Pages cannot run a proxy. For local proxy preview, install Node.js 18 or newer and run:

```text
npm start
```

Then open `http://127.0.0.1:4173`. The proxy binds to localhost, blocks private-network targets, limits redirects and response size, and is intended for personal development only. Some sites will still not work because they depend on login cookies, WebSockets, browser extensions, anti-bot checks, or tightly coupled APIs.
