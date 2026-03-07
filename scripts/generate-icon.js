/**
 * Generate a crosshair icon PNG for the assets directory.
 * Uses raw PNG encoding (no dependencies) to create a 256x256 icon
 * matching the CS2 Clutch Mode branding (orange crosshair on dark bg).
 * 
 * Usage: node scripts/generate-icon.js
 * Output: assets/icon.png
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;

function renderCrosshair(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;

  const circleR = size * 0.38;
  const lineW = Math.max(1, size * 0.055);
  const lineLen = size * 0.12;
  const gapFromCircle = size * 0.02;
  const dotR = Math.max(1, size * 0.02);
  const cornerR = size * 0.15;

  const bgR = 0x2a, bgG = 0x2a, bgB = 0x2a;
  const fgR = 0xf9, fgG = 0x73, fgB = 0x16;

  function setPixel(px, py, r, g, b, a) {
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    if (ix < 0 || ix >= size || iy < 0 || iy >= size) return;
    const off = (iy * size + ix) * 4;
    const srcA = a / 255;
    const dstA = buf[off + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA > 0) {
      buf[off]     = Math.round((r * srcA + buf[off]     * dstA * (1 - srcA)) / outA);
      buf[off + 1] = Math.round((g * srcA + buf[off + 1] * dstA * (1 - srcA)) / outA);
      buf[off + 2] = Math.round((b * srcA + buf[off + 2] * dstA * (1 - srcA)) / outA);
      buf[off + 3] = Math.round(outA * 255);
    }
  }

  // Rounded dark background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true;
      if (x < cornerR && y < cornerR)
        inside = Math.sqrt((x - cornerR) ** 2 + (y - cornerR) ** 2) <= cornerR;
      if (x >= size - cornerR && y < cornerR)
        inside = Math.sqrt((x - (size - cornerR)) ** 2 + (y - cornerR) ** 2) <= cornerR;
      if (x < cornerR && y >= size - cornerR)
        inside = Math.sqrt((x - cornerR) ** 2 + (y - (size - cornerR)) ** 2) <= cornerR;
      if (x >= size - cornerR && y >= size - cornerR)
        inside = Math.sqrt((x - (size - cornerR)) ** 2 + (y - (size - cornerR)) ** 2) <= cornerR;
      if (inside) setPixel(x, y, bgR, bgG, bgB, 255);
    }
  }

  // Circle ring
  const ringW = lineW;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const inner = circleR - ringW / 2;
      const outer = circleR + ringW / 2;
      if (dist >= inner - 0.5 && dist <= outer + 0.5) {
        let alpha = 1;
        if (dist < inner) alpha = 1 - (inner - dist);
        else if (dist > outer) alpha = 1 - (dist - outer);
        alpha = Math.max(0, Math.min(1, alpha));
        if (alpha > 0) setPixel(x, y, fgR, fgG, fgB, Math.round(alpha * 255));
      }
    }
  }

  // Crosshair lines
  const halfW = lineW / 2;
  // Top
  for (let y = Math.floor(cy - circleR - gapFromCircle - lineLen); y <= Math.ceil(cy - circleR - gapFromCircle); y++)
    for (let x = Math.floor(cx - halfW); x <= Math.ceil(cx + halfW); x++)
      setPixel(x, y, fgR, fgG, fgB, 255);
  // Bottom
  for (let y = Math.floor(cy + circleR + gapFromCircle); y <= Math.ceil(cy + circleR + gapFromCircle + lineLen); y++)
    for (let x = Math.floor(cx - halfW); x <= Math.ceil(cx + halfW); x++)
      setPixel(x, y, fgR, fgG, fgB, 255);
  // Left
  for (let x = Math.floor(cx - circleR - gapFromCircle - lineLen); x <= Math.ceil(cx - circleR - gapFromCircle); x++)
    for (let y = Math.floor(cy - halfW); y <= Math.ceil(cy + halfW); y++)
      setPixel(x, y, fgR, fgG, fgB, 255);
  // Right
  for (let x = Math.floor(cx + circleR + gapFromCircle); x <= Math.ceil(cx + circleR + gapFromCircle + lineLen); x++)
    for (let y = Math.floor(cy - halfW); y <= Math.ceil(cy + halfW); y++)
      setPixel(x, y, fgR, fgG, fgB, 255);

  // Center dot
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= dotR + 0.5) {
        const alpha = dist <= dotR ? 1 : Math.max(0, 1 - (dist - dotR));
        setPixel(x, y, fgR, fgG, fgB, Math.round(alpha * 255));
      }
    }

  return buf;
}

// Minimal PNG encoder (no deps)
function encodePNG(width, height, rgba) {
  function crc32(buf) {
    let crc = 0xffffffff;
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length);
    const crcData = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcData));
    return Buffer.concat([lenBuf, crcData, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT: filter rows (filter byte 0 = None for each row)
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter: none
    rgba.copy(raw, y * rowSize + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Generate and save
const rgba = renderCrosshair(SIZE);
const png = encodePNG(SIZE, SIZE, rgba);
const outPath = path.resolve(__dirname, '..', 'assets', 'icon.png');
fs.writeFileSync(outPath, png);
console.log(`Icon generated: ${outPath} (${SIZE}x${SIZE}, ${png.length} bytes)`);
