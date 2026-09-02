const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = 4000;
const HTTPS_PORT = 4443;
const CERTS = path.join(__dirname, "..", "mobile-certs");
const BACKEND = { host: "127.0.0.1", port: 8000 };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".crt": "application/x-x509-ca-cert",
};

function proxyApi(req, res) {
  const options = {
    host: BACKEND.host,
    port: BACKEND.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `${BACKEND.host}:${BACKEND.port}` },
  };
  const upstream = http.request(options, (up) => {
    const headers = { ...up.headers };
    delete headers.connection;
    delete headers["keep-alive"];
    delete headers["transfer-encoding"];
    delete headers.upgrade;
    res.writeHead(up.statusCode || 502, headers);
    up.pipe(res);
  });
  upstream.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ reply: "Backend unreachable: " + err.message }));
  });
  req.pipe(upstream);
}

function serve(req, res) {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath.startsWith("/api/")) {
    proxyApi(req, res);
    return;
  }
  let filePath = urlPath === "/" ? "/index.html" : urlPath;
  const file = path.join(ROOT, filePath);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}

http.createServer(serve).listen(PORT, "0.0.0.0", () => {
  console.log("Vulnexa Live mobile app on http://0.0.0.0:" + PORT);
});

try {
  const httpsOptions = {
    key: fs.readFileSync(path.join(CERTS, "server.key")),
    cert: fs.readFileSync(path.join(CERTS, "server.crt")),
  };
  https.createServer(httpsOptions, serve).listen(HTTPS_PORT, "0.0.0.0", () => {
    console.log("Vulnexa Live mobile app (TLS) on https://0.0.0.0:" + HTTPS_PORT);
  });
} catch (err) {
  console.log("HTTPS disabled: " + err.message);
}
