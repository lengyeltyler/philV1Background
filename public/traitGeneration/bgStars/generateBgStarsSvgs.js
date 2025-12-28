// public/traitGeneration/generateBgStarsSvgs.js
import fs from "fs";
import path from "path";
import crypto from "crypto";

const WIDTH = 420;
const HEIGHT = 420;
const COUNT = 5;

// Keep this modest so SVGO + on-chain storage stays tiny.
// You can bump later if you want denser fields.
const STAR_COUNT_MIN = 90;
const STAR_COUNT_MAX = 160;

// ---------- Seeded RNG (deterministic per variant) ----------
function makeSeed() {
  return crypto.randomBytes(8).toString("hex");
}

// Mulberry32 PRNG
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

function seedToU32(hex) {
  // take first 8 hex chars => uint32
  return parseInt(hex.slice(0, 8), 16) >>> 0;
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

function pickStarColor(rng, mode) {
  // modes control the vibe but still keep stars mostly bright
  if (mode === "warm") {
    const h = 25 + rng() * 40;     // oranges/yellows
    const s = 25 + rng() * 35;
    const l = 75 + rng() * 20;
    return hslToHex(h, s, l);
  }
  if (mode === "cool") {
    const h = 175 + rng() * 70;    // cyans/blues/purples
    const s = 20 + rng() * 45;
    const l = 75 + rng() * 20;
    return hslToHex(h, s, l);
  }
  if (mode === "mono") {
    // mostly white stars with small tint drift
    const h = rng() * 360;
    const s = 5 + rng() * 10;
    const l = 80 + rng() * 18;
    return hslToHex(h, s, l);
  }

  // mixed (default)
  const h = rng() * 360;
  const s = 10 + rng() * 35;
  const l = 75 + rng() * 20;
  return hslToHex(h, s, l);
}

// ---------- Star field generation ----------
function generateBgStarsVariant(seedHex, variantIndex) {
  const rng = mulberry32(seedToU32(seedHex));

  // pick a “style mode” so variants are visibly different
  const modes = ["mixed", "mono", "warm", "cool", "mixed"];
  const mode = modes[variantIndex % modes.length];

  const starCount = randInt(rng, STAR_COUNT_MIN, STAR_COUNT_MAX);

  // Some variants include a few “big glow” stars (still circles; no filters)
  const bigCount = randInt(rng, 4, 10);

  let g = `<g id="bgStars">`;

  // Generate regular stars
  for (let i = 0; i < starCount; i++) {
    const x = fmt1(rng() * WIDTH);
    const y = fmt1(rng() * HEIGHT);

    // small radius, biased toward tiny
    const r = fmt1(0.4 + Math.pow(rng(), 1.8) * 1.3); // ~0.4..1.7

    // opacity biased toward faint with some bright pops
    const op = fmt2(0.15 + Math.pow(rng(), 0.55) * 0.85); // ~0.15..1.0

    const c = pickStarColor(rng, mode);

    g += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${op}"/>`;
  }

  // Add a handful of bigger “anchor” stars
  for (let i = 0; i < bigCount; i++) {
    const x = fmt1(rng() * WIDTH);
    const y = fmt1(rng() * HEIGHT);

    const r = fmt1(1.8 + rng() * 2.8); // ~1.8..4.6
    const op = fmt2(0.35 + rng() * 0.45); // ~0.35..0.8
    const c = pickStarColor(rng, mode);

    g += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${op}"/>`;
  }

  g += `</g>`;

  // standalone svg for previewing
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    g +
    `</svg>`;

  return { svg, mode, starCount, bigCount };
}

function main() {
  const outDir = path.join(process.cwd(), "output", "bgStars");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < COUNT; i++) {
    const seed = makeSeed();
    const { svg, mode, starCount, bigCount } = generateBgStarsVariant(seed, i);

    const fileName = `bgStars_${i}.svg`;
    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, svg, "utf8");

    console.log(`Wrote ${fileName} → ${outPath}`);
    console.log(`  size: ${Buffer.byteLength(svg, "utf8")} bytes`);
    console.log(`  seed: ${seed}`);
    console.log(`  mode: ${mode}`);
    console.log(`  stars: ${starCount} (+${bigCount} big)`);
  }
}

main();