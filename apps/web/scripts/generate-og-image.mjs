/**
 * Generate Open Graph image for SpellStrike (1200x630)
 * Run: node apps/web/scripts/generate-og-image.mjs
 */

import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

const W = 1200;
const H = 630;

function createOGSVG() {
  // Grid parameters — subtle wordle grid in the background
  const cellSize = 44;
  const cellGap = 8;
  const gridCols = 5;
  const gridRows = 4;
  const gridW = gridCols * (cellSize + cellGap) - cellGap;
  const gridH = gridRows * (cellSize + cellGap) - cellGap;
  const gridX = (W - gridW) / 2;
  const gridY = 80;

  const colors = [
    ['#4ade80', '#6b7280', '#6b7280', '#facc15', '#6b7280'],
    ['#6b7280', '#4ade80', '#facc15', '#6b7280', '#4ade80'],
    ['#4ade80', '#4ade80', '#4ade80', '#4ade80', '#4ade80'],
    ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'],
  ];

  let gridRects = '';
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const x = gridX + col * (cellSize + cellGap);
      const y = gridY + row * (cellSize + cellGap);
      const fill = colors[row][col];
      const opacity = fill === '#ffffff' ? '0.08' : '0.15';
      gridRects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="8" fill="${fill}" opacity="${opacity}"/>`;
    }
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8f7ff"/>
      <stop offset="50%" stop-color="#ede5ff"/>
      <stop offset="100%" stop-color="#f3f0ff"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="50%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <linearGradient id="titleGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="${W}" height="6" fill="url(#accent)"/>

  <!-- Background grid -->
  ${gridRects}

  <!-- Card -->
  <rect x="200" y="120" width="800" height="400" rx="28" fill="#ffffff" stroke="#ede9f6" stroke-width="2.5"
    filter="url(#shadow)"/>
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="8" stdDeviation="24" flood-color="#7c3aed" flood-opacity="0.1"/>
    </filter>
  </defs>

  <!-- Logo text -->
  <text x="${W / 2}" y="290" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="900" font-size="80"
    fill="url(#titleGrad)" letter-spacing="2">
    SPELLSTRIKE
  </text>

  <!-- Tagline -->
  <text x="${W / 2}" y="360" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="800" font-size="28"
    fill="#6b7280">
    Epic Word Battles
  </text>

  <!-- Game mode pills -->
  <rect x="295" y="400" width="100" height="36" rx="18" fill="#f3f0ff" stroke="#c4b5fd" stroke-width="1.5"/>
  <text x="345" y="422" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, sans-serif" font-weight="800" font-size="14" fill="#5b21b6">Classic</text>

  <rect x="415" y="400" width="120" height="36" rx="18" fill="#f3f0ff" stroke="#c4b5fd" stroke-width="1.5"/>
  <text x="475" y="422" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, sans-serif" font-weight="800" font-size="14" fill="#5b21b6">QuadWord</text>

  <rect x="555" y="400" width="120" height="36" rx="18" fill="#f3f0ff" stroke="#c4b5fd" stroke-width="1.5"/>
  <text x="615" y="422" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, sans-serif" font-weight="800" font-size="14" fill="#5b21b6">OctoWord</text>

  <rect x="695" y="400" width="110" height="36" rx="18" fill="#f3f0ff" stroke="#c4b5fd" stroke-width="1.5"/>
  <text x="750" y="422" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, sans-serif" font-weight="800" font-size="14" fill="#5b21b6">Gauntlet</text>

  <!-- URL at bottom -->
  <text x="${W / 2}" y="${H - 24}" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, sans-serif" font-weight="700" font-size="18" fill="#9ca3af">
    spellstrike.vercel.app
  </text>
</svg>`;
}

async function generate() {
  const svg = createOGSVG();
  const buffer = await sharp(Buffer.from(svg))
    .png({ quality: 90 })
    .toBuffer();
  const outPath = join(PUBLIC_DIR, 'og-image.png');
  writeFileSync(outPath, buffer);
  console.log(`  ✓ og-image.png (${W}x${H}) — ${(buffer.length / 1024).toFixed(1)}KB`);
}

console.log('Generating SpellStrike OG image...\n');
generate().catch(console.error);
