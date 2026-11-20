const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { pipeline } = require("node:stream");

const root = path.resolve(__dirname, "../build/web");
const backend = new URL(process.env.KAAMGHAR_WEB_UPSTREAM || "http://localhost:3001");
const port = Number(process.env.PORT || 3101);
const sessionCookie = "kg_provider_flutter_session";
const origin = `http://127.0.0.1:${port}`;
const types = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript",
  ".json": "application/json", ".wasm": "application/wasm", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".otf": "font/otf", ".ttf": "font/ttf",
  ".css": "text/css", ".webmanifest": "application/manifest+json",
};

if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error("Build the Flutter web app before starting the local server.");
  process.exit(1);
}

function proxy(req, res, requested) {
  if (!["GET", "HEAD"].includes(req.method) && req.headers.origin && req.headers.origin !== origin) {
    res.writeHead(403).end();
    return;
  }
  const destination = new URL(backend);
  destination.pathname = requested.pathname;
  destination.search = requested.search;
  const headers = { ...req.headers, host: backend.host };
  delete headers.origin;
  const session = req.headers.cookie?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(sessionCookie + "="));
  delete headers.cookie;
  if (session) headers.cookie = "kg_session=" + session.slice(sessionCookie.length + 1);
  const transport = backend.protocol === "https:" ? require("node:https") : http;
  const upstream = transport.request(destination, { method: req.method, headers }, (response) => {
    const responseHeaders = { ...response.headers };
    if (responseHeaders["set-cookie"]) {
      responseHeaders["set-cookie"] = responseHeaders["set-cookie"].map(
        (cookie) => cookie.replace(/^kg_session=/, sessionCookie + "="),
      );
    }
    res.writeHead(response.statusCode, responseHeaders);
    pipeline(response, res, () => {});
  });
  upstream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Start Abr-frontend on port 3001 and try again." }));
    } else {
      res.end();
    }
  });
  pipeline(req, upstream, () => {});
}

http.createServer(async (req, res) => {
  try {
    const requested = new URL(req.url, origin);
    if (requested.pathname.startsWith("/api/")) {
      proxy(req, res, requested);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    const filename = path.resolve(root, "." + decodeURIComponent(requested.pathname === "/" ? "/index.html" : requested.pathname));
    if (!filename.startsWith(root + path.sep)) {
      res.writeHead(404).end();
      return;
    }
    const stat = await fs.promises.stat(filename);
    if (!stat.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(filename)] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
    });
    if (req.method === "HEAD") res.end();
    else pipeline(fs.createReadStream(filename), res, () => {});
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end();
  }
}).listen(port, "127.0.0.1", () => console.log(`KaamGhar Flutter: ${origin}`));
