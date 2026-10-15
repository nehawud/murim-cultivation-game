"use strict";

require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "..");

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

app.use(express.json({ limit: "64kb" }));

const STATIC_ALLOW = /^\/(index\.html|style\.css|favicon\.ico|js\/[\w.-]+\.js)$/;
const staticMw = express.static(ROOT, { dotfiles: "deny", index: "index.html" });

app.get("/", (req, res) => res.sendFile(path.join(ROOT, "index.html")));
app.use((req, res, next) => {
  if (req.method === "GET" && STATIC_ALLOW.test(req.path)) {
    return staticMw(req, res, next);
  }
  next();
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "murim-cultivation-game",
    env: process.env.NODE_ENV || "development",
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

app.use("/api", (req, res) => res.status(404).json({ ok: false, error: "not_found" }));

app.use((err, req, res, next) => {
  console.error("[error]", err.message);
  res.status(500).json({ ok: false, error: "server_error" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Murim game server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
