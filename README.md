# Orbit Browser

A static, GitHub Pages-ready web viewer with embedded preview and direct browser navigation.

## How it works

- **Open directly** opens a site in a real browser tab, so the destination's normal JavaScript, cookies, storage, navigation, and security policies work.
- **Preview here** tries to render the site inside Orbit when the destination permits iframe embedding.
- If the embedded frame stays blank, Orbit offers the direct browser fallback automatically.

## Important limitation

No web page can bypass another site's `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` from client-side JavaScript. A proxy could rewrite those headers, but it would be a separate server with serious security, privacy, authentication, and abuse risks. Direct navigation is the reliable workaround for a static GitHub Pages app.

## Publish

Enable **Settings -> Pages -> Deploy from a branch** and select `main` with `/ (root)`.
