# Orbit Browser

A static, GitHub Pages-ready web viewer. Upload these files to a repository and enable **Settings → Pages → Deploy from a branch**.

## Important limitation

Browsers enforce each destination site's security policy. A static site cannot make a site that sends `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` render in an iframe. The ↗ button opens those sites directly in a new tab. Loading every site *inside* the app would require a backend proxy (and permission from the destination sites) or a native browser application.
