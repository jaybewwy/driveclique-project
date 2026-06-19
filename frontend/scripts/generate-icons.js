#!/usr/bin/env node
/**
 * Generates placeholder PNG icons for the DriveClique mobile app.
 * Each icon is a solid red-600 square (#DC2626) at the required dimensions.
 *
 * Run:  node scripts/generate-icons.js
 *
 * WARNING: public/icons/* now contains the real DriveClique brand icons
 * (generated from the logo mark, not placeholders). Do NOT run this script —
 * it will overwrite them with solid red squares. It is kept only for
 * reference/history and is no longer wired into any npm script.
 */

import { deflateSync } from 'zlib';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// CRC-32 used by PNG chunks
function crc32(buf) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeB = Buffer.from(type, 'ascii');
  const lenB  = Buffer.alloc(4);
  lenB.writeUInt32BE(data.length, 0);
  const crcB  = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
  return Buffer.concat([lenB, typeB, data, crcB]);
}

function makePNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bit-depth=8, color-type=2 (RGB), rest zeros
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB color type

  // Raw scanlines: filter_byte(0) + R G B per pixel, repeated for each row
  const row = Buffer.alloc(1 + size * 3);
  row[0] = 0; // filter: None
  for (let x = 0; x < size; x++) {
    row[1 + x * 3]     = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw  = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = deflateSync(raw); // zlib-wrapped deflate as required by PNG spec

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const iconsDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });

// DriveClique brand: red-600 = rgb(220, 38, 38)
const [R, G, B] = [220, 38, 38];

const icons = [
  { name: 'icon-48.png',              size: 48  },
  { name: 'icon-72.png',              size: 72  },
  { name: 'icon-96.png',              size: 96  },
  { name: 'icon-144.png',             size: 144 },
  { name: 'icon-192.png',             size: 192 },
  { name: 'icon-512.png',             size: 512 },
  { name: 'apple-touch-icon.png',     size: 180 },
  { name: 'apple-touch-icon-152.png', size: 152 },
  { name: 'apple-touch-icon-167.png', size: 167 },
];

for (const { name, size } of icons) {
  writeFileSync(join(iconsDir, name), makePNG(size, R, G, B));
  console.log(`  created  ${name}  (${size}x${size})`);
}

console.log('\nPlaceholder icons written to public/icons/');
console.log('Replace with real branded icons before app store submission.\n');
