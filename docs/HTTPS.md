# "Not secure" / HTTPS

## Why Chrome says "Not secure" on `localhost:3000`

Chrome marks any `http://` URL as "Not secure" in the address bar. On
`http://localhost:3000` that warning is Chrome labelling the protocol — it
is not a bug in the site. No action is required for local development.

## Production: HTTPS is automatic

Both deploy targets provision HTTPS without any manual certificate work.

### Render (`render.yaml` — current primary host)

- The `*.onrender.com` URL is already HTTPS.
- When a custom domain is attached, Render provisions a Let's Encrypt
  certificate within a few minutes of DNS propagation. No key material lives
  in the repo.
- In the Render service's environment variables, set `AUTH_URL` to the
  `https://` origin (not `http://`). NextAuth uses this value to decide
  whether to issue secure cookies — if it's `http://`, cookies will be
  cross-site-blocked in modern browsers.

### Cloudflare Workers (via OpenNext + `wrangler.jsonc`)

- Cloudflare serves every Worker on HTTPS by default with its own universal
  certificate.
- `wrangler.jsonc` already pins `AUTH_URL=https://wucoireland.ie`, so no
  action is needed on the CF side unless the custom domain changes.

## What never changes

- Secrets live in gitignored env files (Render env vars, Cloudflare secret
  bindings) — never commit them.
- Serving over HTTP in production is not supported by NextAuth v5 (secure
  cookie regime); the Render and CF defaults ensure that doesn't happen by
  accident.
