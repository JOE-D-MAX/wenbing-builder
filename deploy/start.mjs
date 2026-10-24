// Render supplies the exact public HTTPS origin for each web service.
// An explicit FORMA_PUBLIC_ORIGIN still takes precedence for self-hosting.
if (!process.env.FORMA_PUBLIC_ORIGIN && process.env.RENDER_EXTERNAL_URL) {
  process.env.FORMA_PUBLIC_ORIGIN = process.env.RENDER_EXTERNAL_URL;
}

await import('../scripts/check-runtime.mjs');

// Docker copies the complete Vinext standalone output to /app.
await import('../server.js');
