// Copies ffmpeg.wasm's core runtime (JS + WASM) from node_modules into
// public/ffmpeg so the video trimmer can load it from our own origin - no
// CDN dependency, no CORS/COEP surprises. Runs on every install (postinstall)
// since node_modules isn't committed to git.
const fs = require("node:fs");
const path = require("node:path");

const srcDir = path.join(__dirname, "..", "node_modules", "@ffmpeg", "core", "dist", "umd");
const destDir = path.join(__dirname, "..", "public", "ffmpeg");

if (!fs.existsSync(srcDir)) {
  console.warn("[copy-ffmpeg-core] @ffmpeg/core not found, skipping (video trimmer will not work).");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });

for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}

console.log("[copy-ffmpeg-core] Copied ffmpeg-core.js and ffmpeg-core.wasm to public/ffmpeg/");
