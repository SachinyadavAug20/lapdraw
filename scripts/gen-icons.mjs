// Generates simple "pen nib" PNG icons (16/32/48/128) with zero dependencies.
// Pure-Node PNG writer: RGBA rows, no filtering, zlib deflate via node:zlib.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "icons");
mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  // pixels: Uint8Array RGBA
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // no filter
    pixels.copy?.(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
    if (!pixels.copy) Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// Draw: indigo rounded square + white diagonal pen stroke with a small nib triangle
function makeIcon(size) {
  const px = new Uint8ClampedArray(size * size * 4);
  const S = size / 16; // scale from a 16-unit design grid
  const strokeW = 2.2 * S;
  const K = [0.55, 0.62, 1.0]; // RGB for indigo-blue
  const BG = [0.12, 0.13, 0.16];
  const last = size - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      // rounded-square mask
      const rad = 4 * S;
      const dx = Math.max(rad, Math.min(last + 0.5 - rad, cx)) - cx;
      const dy = Math.max(rad, Math.min(last + 0.5 - rad, cy)) - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const inside = dist <= rad - 0.5;
      if (!inside) continue;
      let r = BG[0], g = BG[1], b = BG[2];
      // diagonal stroke from (4,12)->(12,4) in design units
      const t = ((cx - 4 * S) + (12 * S - cy)) / 2; // projection along diagonal
      const d = Math.abs((cx - 4 * S) - (12 * S - cy)) / Math.SQRT2; // distance to diagonal
      if (t > 0.5 * S && t < 9.5 * S && d < strokeW / 2) {
        r = 1; g = 1; b = 1;
      }
      // nib: small triangle near the bottom-left end
      const nx = cx - 4 * S, ny = cy - 12 * S;
      if (nx >= -1.8 * S && nx <= 1.8 * S && ny >= -1.8 * S && ny <= 1.8 * S && t <= 1.4 * S) {
        r = 1; g = 1; b = 1;
      }
      const i = (y * size + x) * 4;
      px[i] = Math.round(r * 255);
      px[i + 1] = Math.round(g * 255);
      px[i + 2] = Math.round(b * 255);
      px[i + 3] = 255;
    }
  }
  return Buffer.from(px.buffer);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(OUT, `icon${size}.png`), png(size, makeIcon(size)));
  console.log(`icon${size}.png written`);
}
