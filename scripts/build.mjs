// Builds dist/chrome and dist/firefox plus store-ready zips.
// Usage: node scripts/build.mjs

import { cpSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = join(root, "dist");

function build(target, manifest) {
  const out = join(dist, target);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(src, out, { recursive: true });
  // swap in the browser-specific manifest and remove the other one
  const manifests = ["manifest.chrome.json", "manifest.firefox.json"];
  for (const m of manifests) rmSync(join(out, m));
  cpSync(join(src, manifest), join(out, "manifest.json"));
  const packName = `lapdraw-${target}-v0.1.0.zip`;
  try {
    execFileSync("zip", ["-qr", `../${packName}`, "."], { cwd: out, stdio: "inherit" });
    console.log(`✔ dist/${target} + ${packName}`);
  } catch {
    console.warn(`⚠ zip not found — dist/${target} created, zip it manually for store upload`);
  }
}

build("chrome", "manifest.chrome.json");
build("firefox", "manifest.firefox.json");
