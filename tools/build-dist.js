"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const HEADERS = [
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  X-Frame-Options: DENY",
  "  Referrer-Policy: no-referrer",
  "  Permissions-Policy: geolocation=(), microphone=(), camera=()",
  "  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  "",
].join("\n");

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "js"), { recursive: true });

fs.copyFileSync(path.join(ROOT, "index.html"), path.join(DIST, "index.html"));
fs.copyFileSync(path.join(ROOT, "style.css"), path.join(DIST, "style.css"));

for (const f of fs.readdirSync(path.join(ROOT, "js"))) {
  if (f.endsWith(".js")) {
    fs.copyFileSync(path.join(ROOT, "js", f), path.join(DIST, "js", f));
  }
}

fs.writeFileSync(path.join(DIST, "_headers"), HEADERS);
fs.writeFileSync(path.join(DIST, ".nojekyll"), "");

console.log("dist/ rebuilt from index.html, style.css, js/*.js (+ _headers, .nojekyll)");
