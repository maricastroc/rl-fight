// Minimal static server for the exported site (`npm run preview`, Playwright).
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "out");
const port = Number(process.argv[3] ?? 4173);
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

function resolveFile(urlPath) {
  let path = decodeURIComponent(urlPath.split("?")[0]);
  if (basePath && path.startsWith(basePath)) path = path.slice(basePath.length) || "/";
  const candidate = normalize(join(root, path));
  if (!candidate.startsWith(root)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  const index = join(candidate, "index.html");
  if (existsSync(index)) return index;
  return null;
}

createServer((request, response) => {
  const file = resolveFile(request.url ?? "/");
  if (!file) {
    const notFound = join(root, "404.html");
    response.writeHead(404, { "content-type": TYPES[".html"] });
    if (existsSync(notFound)) createReadStream(notFound).pipe(response);
    else response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}${basePath}/`);
});
