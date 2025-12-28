// public/traitGeneration/generateBgDustSvgs.js
import fs from "fs";
import path from "path";
import crypto from "crypto";

const WIDTH = 420;
const HEIGHT = 420;
const COUNT = 5;

// Keep dust relatively light so it's cheap + doesn't overpower stars.
// You can bump later.
const DUST_MIN = 70;
const DUST_MAX = 140;

// ---------- Seeded RNG (so each variant is reproducible if you save the seed) ----------
function makeSeed() {
  return crypto.randomBytes(8).toString("hex");
}
function seedToU32(hex) {
  return parseInt(hex.slice(0, 8), 16) >>> 0;
}
function mulberry32(seedUint32) {
  let a = seedUint32 >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function fmt1(n) {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}
function fmt2(n) {
  const s = n.toFixed(2);
  return s.endsWith(".00") ? s.slice(0, -3) : s;
}

// ---------- Color (HSL -> hex) ----------
function componentToHex(c) {
  const hex = Math.round(c).toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}
function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  return `#${componentToHex(f(0))}${componentToHex(f(8))}${componentToHex(f(4))}`;
}

function pickDustColor(rng, mode) {
  // Dust should be softer than stars; slightly tinted.
  if (mode === "magenta") {
    const h = 285 + rng() * 50; // purples/pinks
    const s = 25 + rng() * 25;
    const l = 55 + rng() * 18;
    return hslToHex(h, s, l);
  }
  if (mode === "teal") {
    const h = 160 + rng() * 60; // teal/cyan
    const s = 20 + rng() * 30;
    const l = 55 + rng() * 18;
    return hslToHex(h, s, l);
  }
  if (mode === "gold") {
    const h = 35 + rng() * 40; // warm dust
    const s = 18 + rng() * 22;
    const l = 55 + rng() * 18;
    return hslToHex(h, s, l);
  }
  if (mode === "blue") {
    const h = 200 + rng() * 70;
    const s = 20 + rng() * 25;
    const l = 55 + rng() * 18;
    return hslToHex(h, s, l);
  }

  // mixed
  const h = rng() * 360;
  const s = 15 + rng() * 25;
  const l = 55 + rng() * 18;
  return hslToHex(h, s, l);
}

// ---------- Distribution helpers ----------
function biasedAroundCenter(rng, cx, cy, spread) {
  // Box-Muller-ish cheap approximation (sum of uniforms -> bell-ish)
  const u = (rng() + rng() + rng() + rng()) / 4; // ~0..1 bell-ish
  const v = (rng() + rng() + rng() + rng()) / 4;
  const x = cx + (u - 0.5) * spread;
  const y = cy + (v - 0.5) * spread;
  return [x, y];
}

function generateDustVariant(seedHex, variantIndex) {
  const rng = mulberry32(seedToU32(seedHex));

  // Different vibes per variant
  const modes = ["mixed", "magenta", "teal", "gold", "blue"];
  const mode = modes[variantIndex % modes.length];

  // Dust count and two “clusters” to make it look like nebula haze, not uniform noise
  const dustCount = randInt(rng, DUST_MIN, DUST_MAX);
  const clusters = randInt(rng, 2, 3);

  const centers = [];
  for (let i = 0; i < clusters; i++) {
    centers.push([
      210 + (rng() - 0.5) * 140,
      210 + (rng() - 0.5) * 140,
      220 + rng() * 260, // spread
    ]);
  }

  let g = `<g id="bgDust">`;

  for (let i = 0; i < dustCount; i++) {
    const pickCluster = centers[i % centers.length];
    const [ccx, ccy, spread] = pickCluster;

    let x, y;

    // Mix clustered + uniform points
    if (rng() < 0.72) {
      [x, y] = biasedAroundCenter(rng, ccx, ccy, spread);
    } else {
      x = rng() * WIDTH;
      y = rng() * HEIGHT;
    }

    // Clamp into canvas
    if (x < 0) x = 0;
    if (x > WIDTH) x = WIDTH;
    if (y < 0) y = 0;
    if (y > HEIGHT) y = HEIGHT;

    // dust radius: mostly small, some larger puffs
    const r =
      rng() < 0.18
        ? (1.8 + rng() * 5.8) // occasional puff
        : (0.6 + Math.pow(rng(), 1.6) * 1.9); // mostly 0.6..2.5-ish

    // opacity: faint haze
    const op = 0.06 + Math.pow(rng(), 0.7) * 0.22; // ~0.06..0.28

    const c = pickDustColor(rng, mode);

    g += `<circle cx="${fmt1(x)}" cy="${fmt1(y)}" r="${fmt1(r)}" fill="${c}" opacity="${fmt2(op)}"/>`;
  }

  g += `</g>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    g +
    `</svg>`;

  return { svg, mode, dustCount };
}

function main() {
  const outDir = path.join(process.cwd(), "output", "bgDust");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < COUNT; i++) {
    const seed = makeSeed();
    const { svg, mode, dustCount } = generateDustVariant(seed, i);

    const fileName = `bgDust_${i}.svg`;
    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, svg, "utf8");

    console.log(`Wrote ${fileName} → ${outPath}`);
    console.log(`  size: ${Buffer.byteLength(svg, "utf8")} bytes`);
    console.log(`  seed: ${seed}`);
    console.log(`  mode: ${mode}`);
    console.log(`  dust circles: ${dustCount}`);
  }
}

main();