// Builds dist/chrome and dist/firefox plus store-ready zips.
// Usage: node scripts/build.mjs

import { cpSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = join(root, "dist");

async function version() {
  const pkg = JSON.parse(await import("node:fs/promises").then((f) => f.readFile(join(root, "package.json"), "utf8")));
  return pkg.version;
}

async function build(target, manifest) {
  const ver = await version();
  const out = join(dist, target);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(src, out, { recursive: true });
  // swap in the browser-specific manifest and remove the other one
  const manifests = ["manifest.chrome.json", "manifest.firefox.json"];
  for (const m of manifests) rmSync(join(out, m));
  cpSync(join(src, manifest), join(out, "manifest.json"));
  const packName = `lapdraw-${target}-v${ver}.zip`;
  try {
    execFileSync("zip", ["-qr", `../${packName}`, "."], { cwd: out, stdio: "inherit" });
    console.log(`✔ dist/${target} + ${packName}`);
  } catch {
    console.warn(`⚠ zip not found — dist/${target} created, zip it manually for store upload`);
  }
}

await build("chrome", "manifest.chrome.json");
await build("firefox", "manifest.firefox.json");
