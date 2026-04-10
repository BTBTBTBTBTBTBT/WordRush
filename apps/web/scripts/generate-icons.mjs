/**
 * Generate app icons for SpellStrike
 * Run: node apps/web/scripts/generate-icons.mjs
 *
 * Generates:
 *   - public/favicon.ico (32x32)
 *   - public/apple-touch-icon.png (180x180)
 *   - public/icon-192.png (192x192)
 *   - public/icon-512.png (512x512)
 */

import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

function createSVG(size) {
  const fontSize = Math.round(size * 0.13);
  const subtitleSize = Math.round(size * 0.06);
  const padding = Math.round(size * 0.08);
  const borderRadius = Math.round(size * 0.18);

  // Grid parameters for the 5x6 wordle grid in the background
  const gridStartX = Math.round(size * 0.15);
  const gridStartY = Math.round(size * 0.12);
  const cellSize = Math.round(size * 0.1);
  const cellGap = Math.round(size * 0.025);
  const cellRadius = Math.round(cellSize * 0.15);

  // Generate grid cells with some colored (like a game in progress)
  const colors = [
    // Row 1 - some greens and yellows
    ['#4ade80', '#6b7280', '#6b7280', '#facc15', '#6b7280'],
    // Row 2
    ['#6b7280', '#4ade80', '#facc15', '#6b7280', '#4ade80'],
    // Row 3
    ['#4ade80', '#4ade80', '#4ade80', '#4ade80', '#4ade80'],
    // Row 4 - empty
    ['#ffffff20', '#ffffff20', '#ffffff20', '#ffffff20', '#ffffff20'],
    // Row 5 - empty
    ['#ffffff20', '#ffffff20', '#ffffff20', '#ffffff20', '#ffffff20'],
    // Row 6 - empty
    ['#ffffff20', '#ffffff20', '#ffffff20', '#ffffff20', '#ffffff20'],
  ];

  let gridRects = '';
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 5; col++) {
      const x = gridStartX + col * (cellSize + cellGap);
      const y = gridStartY + row * (cellSize + cellGap);
      gridRects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" fill="${colors[row][col]}" opacity="0.3"/>`;
    }
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <linearGradient id="textGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f0e0ff"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${borderRadius}" fill="url(#bg)"/>
  ${gridRects}
  <text x="${size / 2}" y="${size * 0.58}" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${fontSize}"
    fill="white" letter-spacing="${Math.round(size * 0.005)}">
    SPELL
  </text>
  <text x="${size / 2}" y="${size * 0.74}" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${fontSize}"
    fill="white" letter-spacing="${Math.round(size * 0.005)}">
    STRIKE
  </text>
  <text x="${size / 2}" y="${size * 0.88}" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="${subtitleSize}"
    fill="white" opacity="0.7" letter-spacing="${Math.round(size * 0.01)}">
    WORD BATTLES
  </text>
</svg>`;
}

async function generateIcons() {
  const sizes = [
    { name: 'favicon-32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
  ];

  for (const { name, size } of sizes) {
    const svg = createSVG(size);
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const outPath = join(PUBLIC_DIR, name);
    writeFileSync(outPath, buffer);
    console.log(`  ✓ ${name} (${size}x${size})`);
  }

  // Create favicon.ico from the 32px PNG
  // ICO format: simple uncompressed ICO with PNG payload
  const favicon32 = await sharp(Buffer.from(createSVG(32))).png().toBuffer();
  const icoBuffer = createICO(favicon32, 32);
  writeFileSync(join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
  console.log('  ✓ favicon.ico (32x32)');

  console.log('\nAll icons generated in apps/web/public/');
}

function createICO(pngBuffer, size) {
  // ICO file format header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // Type: ICO
  header.writeUInt16LE(1, 4);      // Number of images

  // ICO directory entry
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);  // Width
  entry.writeUInt8(size === 256 ? 0 : size, 1);  // Height
  entry.writeUInt8(0, 2);          // Color palette
  entry.writeUInt8(0, 3);          // Reserved
  entry.writeUInt16LE(1, 4);       // Color planes
  entry.writeUInt16LE(32, 6);      // Bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);  // Size of image data
  entry.writeUInt32LE(22, 12);     // Offset to image data (6 + 16 = 22)

  return Buffer.concat([header, entry, pngBuffer]);
}

console.log('Generating SpellStrike app icons...\n');
generateIcons().catch(console.error);
