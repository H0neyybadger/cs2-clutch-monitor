/**
 * CS2 Clutch Mode — Tray Icon Generator
 * 
 * Generates a crosshair icon matching the CS2 Clutch Mode branding
 * (orange crosshair on dark background) at multiple sizes for
 * tray, taskbar, and window use. Pure pixel rendering, no deps.
 */

const { nativeImage } = require('electron');

/**
 * Draw an orange crosshair on dark bg at the given size.
 * Matches Image 2 branding: #f97316 orange, #2a2a2a dark bg,
 * circle + 4 crosshair lines + center dot.
 */
function renderCrosshair(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;

  // Proportional sizing
  const circleR = size * 0.38;
  const lineW = Math.max(1, size * 0.06);
  const lineLen = size * 0.12;
  const gapFromCircle = size * 0.02;
  const dotR = Math.max(1, size * 0.025);

  // Colors
  const bgR = 0x2a, bgG = 0x2a, bgB = 0x2a;
  const fgR = 0xf9, fgG = 0x73, fgB = 0x16; // #f97316

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const off = (iy * size + ix) * 4;
    // Alpha blend
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

  // Fill dark background with rounded corners
  const cornerR = size * 0.15;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Check rounded corners
      let inside = true;
      // Top-left
      if (x < cornerR && y < cornerR) {
        inside = Math.sqrt((x - cornerR) ** 2 + (y - cornerR) ** 2) <= cornerR;
      }
      // Top-right
      if (x >= size - cornerR && y < cornerR) {
        inside = Math.sqrt((x - (size - cornerR)) ** 2 + (y - cornerR) ** 2) <= cornerR;
      }
      // Bottom-left
      if (x < cornerR && y >= size - cornerR) {
        inside = Math.sqrt((x - cornerR) ** 2 + (y - (size - cornerR)) ** 2) <= cornerR;
      }
      // Bottom-right
      if (x >= size - cornerR && y >= size - cornerR) {
        inside = Math.sqrt((x - (size - cornerR)) ** 2 + (y - (size - cornerR)) ** 2) <= cornerR;
      }
      if (inside) {
        setPixel(x, y, bgR, bgG, bgB, 255);
      }
    }
  }

  // Draw circle (anti-aliased ring)
  const ringW = lineW;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const innerEdge = circleR - ringW / 2;
      const outerEdge = circleR + ringW / 2;
      if (dist >= innerEdge - 0.5 && dist <= outerEdge + 0.5) {
        let alpha = 1;
        if (dist < innerEdge) alpha = 1 - (innerEdge - dist);
        else if (dist > outerEdge) alpha = 1 - (dist - outerEdge);
        alpha = Math.max(0, Math.min(1, alpha));
        if (alpha > 0) {
          setPixel(x, y, fgR, fgG, fgB, Math.round(alpha * 255));
        }
      }
    }
  }

  // Draw crosshair lines (top, bottom, left, right)
  // Lines extend from circle edge outward
  const halfW = lineW / 2;

  // Top line
  for (let y = Math.floor(cy - circleR - gapFromCircle - lineLen); y <= Math.ceil(cy - circleR - gapFromCircle); y++) {
    for (let x = Math.floor(cx - halfW); x <= Math.ceil(cx + halfW); x++) {
      setPixel(x, y, fgR, fgG, fgB, 255);
    }
  }
  // Bottom line
  for (let y = Math.floor(cy + circleR + gapFromCircle); y <= Math.ceil(cy + circleR + gapFromCircle + lineLen); y++) {
    for (let x = Math.floor(cx - halfW); x <= Math.ceil(cx + halfW); x++) {
      setPixel(x, y, fgR, fgG, fgB, 255);
    }
  }
  // Left line
  for (let x = Math.floor(cx - circleR - gapFromCircle - lineLen); x <= Math.ceil(cx - circleR - gapFromCircle); x++) {
    for (let y = Math.floor(cy - halfW); y <= Math.ceil(cy + halfW); y++) {
      setPixel(x, y, fgR, fgG, fgB, 255);
    }
  }
  // Right line
  for (let x = Math.floor(cx + circleR + gapFromCircle); x <= Math.ceil(cx + circleR + gapFromCircle + lineLen); x++) {
    for (let y = Math.floor(cy - halfW); y <= Math.ceil(cy + halfW); y++) {
      setPixel(x, y, fgR, fgG, fgB, 255);
    }
  }

  // Center dot
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= dotR + 0.5) {
        const alpha = dist <= dotR ? 1 : Math.max(0, 1 - (dist - dotR));
        setPixel(x, y, fgR, fgG, fgB, Math.round(alpha * 255));
      }
    }
  }

  return buf;
}

/**
 * Create a nativeImage tray icon at 16x16 (with 32x32 @2x).
 */
function createTrayIcon() {
  const img16 = renderCrosshair(16);
  const img32 = renderCrosshair(32);

  const icon = nativeImage.createEmpty();
  icon.addRepresentation({ width: 16, height: 16, buffer: img16, scaleFactor: 1.0 });
  icon.addRepresentation({ width: 32, height: 32, buffer: img32, scaleFactor: 2.0 });
  return icon;
}

/**
 * Create a nativeImage app icon at 256x256 for window title / alt-tab.
 */
function createAppIcon() {
  const img256 = renderCrosshair(256);
  return nativeImage.createFromBuffer(img256, { width: 256, height: 256 });
}

module.exports = { createTrayIcon, createAppIcon, renderCrosshair };
