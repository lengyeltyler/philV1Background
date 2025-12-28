import fs from "fs";
import path from "path";
import crypto from "crypto";

const WIDTH = 420;
const HEIGHT = 420;
const TARGET_BYTES = 20 * 1024; // 20KB

// ---------- RNG ----------
function rand01() {
  const x = crypto.randomBytes(4).readUInt32BE(0);
  return x / 0x1_0000_0000;
}
function randInt(min, max) {
  return Math.floor(rand01() * (max - min + 1)) + min;
}
function choice(arr) {
  return arr[Math.floor(rand01() * arr.length)];
}

// ---------- Formatting ----------
function fmt1(n) {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ---------- Color ----------
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
function generatePalette() {
  const baseHue = rand01() * 360;
  const count = randInt(3, 4);
  const out = [];
  for (let i = 0; i < count; i++) {
    const hue = (baseHue + rand01() * 220 + i * 40) % 360;
    const sat = 55 + rand01() * 35;
    const light = 45 + rand01() * 30;
    out.push(hslToHex(hue, sat, light));
  }
  return out;
}

// ---------- Style presets (MODE = geometry family) ----------
function pickStyle() {
  const styles = [
    // Spiral variants
    {
      name: "spiralClassic",
      mode: "spiral",
      turns: randInt(3, 5),
      tightness: 0.18 + rand01() * 0.18,
      wobble: 0.12 + rand01() * 0.35,
      baseGap: 5.4,
      baseStroke: 2.1,
      opacity: 0.85,
    },

    // Spider legs (what you asked for)
    {
      name: "spiderLegs",
      mode: "spider",
      legs: randInt(5, 8),
      joints: randInt(3, 4),      // how many bends per leg
      splay: 0.55 + rand01() * 0.35, // lateral bend
      jag: 0.12 + rand01() * 0.25,   // extra jitter
      baseGap: 6.2,
      baseStroke: 2.2,
      opacity: 0.88,
    },

    // Lightning legs
    {
      name: "zigzagLegs",
      mode: "zigzag",
      legs: randInt(5, 7),
      zigs: randInt(5, 8),
      amplitude: 10 + rand01() * 18,
      baseGap: 6.6,
      baseStroke: 2.0,
      opacity: 0.86,
    },

    // Petal arms (curvy)
    {
      name: "petalBloom",
      mode: "petal",
      petals: randInt(5, 9),
      curl: 0.55 + rand01() * 0.55,
      baseGap: 5.0,
      baseStroke: 2.1,
      opacity: 0.84,
    },

    // Hard starburst spikes
    {
      name: "starburst",
      mode: "starburst",
      spikes: randInt(6, 12),
      inner: 30 + rand01() * 40,
      outer: 150 + rand01() * 40,
      baseGap: 7.0,
      baseStroke: 2.0,
      opacity: 0.9,
    },
  ];

  return choice(styles);
}

// ---------- Geometry builders (RETURN SVG path "d") ----------

function buildPathSpiral(points, armIndex, totalArms, cx, cy, style) {
  const maxRadius = WIDTH * 0.4;
  const rot = (armIndex / totalArms) * Math.PI * 2;
  const { turns, tightness, wobble } = style;

  let d = "";
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const radius = t * maxRadius;

    const angle =
      rot +
      t * Math.PI * 2 * turns +
      Math.sin(t * Math.PI) * tightness +
      Math.sin(t * 12.0) * wobble * 0.06;

    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    if (x < -5 || x > WIDTH + 5 || y < -5 || y > HEIGHT + 5) continue;

    const cmd = d.length === 0 ? "M" : "L";
    d += `${cmd}${fmt1(x)} ${fmt1(y)}`;
  }
  return d;
}

function buildPathSpiderLeg(legIndex, totalLegs, cx, cy, style) {
  // Rigid legs with joints, not spiral at all.
  const maxR = WIDTH * 0.42;
  const baseAng = (legIndex / totalLegs) * Math.PI * 2 + (rand01() - 0.5) * 0.15;

  const joints = style.joints;
  const splay = style.splay;
  const jag = style.jag;

  let x = cx;
  let y = cy;

  let d = `M${fmt1(x)} ${fmt1(y)}`;

  for (let j = 1; j <= joints; j++) {
    const t = j / joints;
    const segLen = lerp(35, maxR, t) / joints;

    // alternating bend direction makes it look like "legs"
    const bendDir = (legIndex % 2 === 0 ? 1 : -1);
    const bend = bendDir * splay * (0.35 + 0.65 * t);

    const ang =
      baseAng +
      bend +
      Math.sin(t * Math.PI * 2) * 0.12 +
      (rand01() - 0.5) * jag;

    x += Math.cos(ang) * segLen;
    y += Math.sin(ang) * segLen;

    d += ` L${fmt1(x)} ${fmt1(y)}`;
  }

  return d;
}

function buildPathZigzagLeg(legIndex, totalLegs, cx, cy, style) {
  const maxR = WIDTH * 0.42;
  const baseAng = (legIndex / totalLegs) * Math.PI * 2;

  const zigs = style.zigs;
  const amp = style.amplitude;

  let d = `M${fmt1(cx)} ${fmt1(cy)}`;

  for (let i = 1; i <= zigs; i++) {
    const t = i / zigs;
    const r = t * maxR;

    // zig across the radial direction
    const side = (i % 2 === 0 ? 1 : -1);
    const off = side * amp * (0.25 + 0.75 * t);

    const x = cx + Math.cos(baseAng) * r + Math.cos(baseAng + Math.PI / 2) * off;
    const y = cy + Math.sin(baseAng) * r + Math.sin(baseAng + Math.PI / 2) * off;

    d += ` L${fmt1(x)} ${fmt1(y)}`;
  }

  return d;
}

function buildPathPetal(petalIndex, totalPetals, cx, cy, style) {
  // One curved petal using a cubic Bezier:
  const ang = (petalIndex / totalPetals) * Math.PI * 2;
  const r0 = 12;
  const r1 = WIDTH * 0.18;
  const r2 = WIDTH * 0.42;

  const curl = style.curl; // how far the petal bends

  const sx = cx + Math.cos(ang) * r0;
  const sy = cy + Math.sin(ang) * r0;

  // control points rotated to create “petal”
  const c1a = ang + curl;
  const c2a = ang - curl;

  const c1x = cx + Math.cos(c1a) * r1;
  const c1y = cy + Math.sin(c1a) * r1;

  const c2x = cx + Math.cos(c2a) * r2 * 0.75;
  const c2y = cy + Math.sin(c2a) * r2 * 0.75;

  const ex = cx + Math.cos(ang) * r2;
  const ey = cy + Math.sin(ang) * r2;

  return `M${fmt1(sx)} ${fmt1(sy)} C${fmt1(c1x)} ${fmt1(c1y)} ${fmt1(c2x)} ${fmt1(c2y)} ${fmt1(ex)} ${fmt1(ey)}`;
}

function buildPathStarburst(spikeIndex, totalSpikes, cx, cy, style) {
  const ang = (spikeIndex / totalSpikes) * Math.PI * 2;
  const inner = style.inner;
  const outer = style.outer;

  const x1 = cx + Math.cos(ang) * inner;
  const y1 = cy + Math.sin(ang) * inner;

  const x2 = cx + Math.cos(ang) * outer;
  const y2 = cy + Math.sin(ang) * outer;

  return `M${fmt1(cx)} ${fmt1(cy)} L${fmt1(x1)} ${fmt1(y1)} L${fmt1(x2)} ${fmt1(y2)}`;
}

// ---------- Assemble group ----------
function generateSpiralGroup({ style, palette, detail }) {
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  let body = `<g id="bgSpiral">`;

  // Dotted trick: round caps + dasharray "0 gap"
  const { baseGap, baseStroke, opacity } = style;

  // keep tiny but slightly varied
  const maxArmsColor = palette.length;

  if (style.mode === "spiral") {
    const numArms = randInt(3, 5);
    const pointsPerArm = detail; // detail is pointsPerArm for spiral

    for (let a = 0; a < numArms; a++) {
      const color = palette[a % maxArmsColor];
      const d = buildPathSpiral(pointsPerArm, a, numArms, cx, cy, style);
      if (!d) continue;

      const gap = (baseGap + (a % 2) * 0.6).toFixed(1).replace(/\.0$/, "");
      const sw = (baseStroke + (a % 3) * 0.2).toFixed(1).replace(/\.0$/, "");

      body += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="0 ${gap}" opacity="${opacity}"/>`;
    }
  }

  if (style.mode === "spider") {
    const legs = style.legs;

    for (let i = 0; i < legs; i++) {
      const color = palette[i % maxArmsColor];
      const d = buildPathSpiderLeg(i, legs, cx, cy, style);

      const gap = (baseGap + (i % 2) * 0.7).toFixed(1).replace(/\.0$/, "");
      const sw = (baseStroke + (i % 3) * 0.2).toFixed(1).replace(/\.0$/, "");

      body += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="0 ${gap}" opacity="${opacity}"/>`;
    }
  }

  if (style.mode === "zigzag") {
    const legs = style.legs;

    for (let i = 0; i < legs; i++) {
      const color = palette[i % maxArmsColor];
      const d = buildPathZigzagLeg(i, legs, cx, cy, style);

      const gap = (baseGap + (i % 2) * 0.8).toFixed(1).replace(/\.0$/, "");
      const sw = (baseStroke + (i % 3) * 0.2).toFixed(1).replace(/\.0$/, "");

      body += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="0 ${gap}" opacity="${opacity}"/>`;
    }
  }

  if (style.mode === "petal") {
    const petals = style.petals;

    for (let i = 0; i < petals; i++) {
      const color = palette[i % maxArmsColor];

      // detail can downscale petals if needed (rare, but keeps target strict)
      if (i >= detail) break;

      const d = buildPathPetal(i, petals, cx, cy, style);

      const gap = (baseGap + (i % 2) * 0.6).toFixed(1).replace(/\.0$/, "");
      const sw = (baseStroke + (i % 3) * 0.2).toFixed(1).replace(/\.0$/, "");

      body += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="0 ${gap}" opacity="${opacity}"/>`;
    }
  }

  if (style.mode === "starburst") {
    const spikes = style.spikes;

    for (let i = 0; i < spikes; i++) {
      const color = palette[i % maxArmsColor];

      if (i >= detail) break;

      const d = buildPathStarburst(i, spikes, cx, cy, style);

      const gap = (baseGap + (i % 2) * 0.9).toFixed(1).replace(/\.0$/, "");
      const sw = (baseStroke + (i % 3) * 0.2).toFixed(1).replace(/\.0$/, "");

      body += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="0 ${gap}" opacity="${opacity}"/>`;
    }
  }

  body += `</g>`;
  return body;
}

// ---------- Keep output under 20KB ----------
function generateSvgUnder20kb() {
  const style = pickStyle();
  const palette = generatePalette();

  // "detail" means different things depending on mode:
  // - spiral: pointsPerArm
  // - petal/starburst: max arms to include (cap)
  // - spider/zigzag: usually already tiny; detail is not used much
  let detail =
    style.mode === "spiral" ? 220 :
    style.mode === "petal" ? style.petals :
    style.mode === "starburst" ? style.spikes :
    999;

  while (true) {
    const group = generateSpiralGroup({ style, palette, detail });

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
      group +
      `</svg>`;

    const bytes = Buffer.byteLength(svg, "utf8");

    if (bytes <= TARGET_BYTES) {
      return { svg, bytes, style, palette, detail };
    }

    // Reduce detail until it fits
    if (style.mode === "spiral") {
      detail -= 10; // fewer points
      if (detail < 40) return { svg, bytes, style, palette, detail: 40 };
    } else if (style.mode === "petal" || style.mode === "starburst") {
      detail -= 1; // fewer arms
      if (detail < 3) return { svg, bytes, style, palette, detail: 3 };
    } else {
      // spider/zigzag are already very small; if we ever exceed, drop stroke details by forcing fit
      return { svg, bytes, style, palette, detail };
    }
  }
}

function main() {
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const { svg, bytes, style, palette, detail } = generateSvgUnder20kb();
  const outPath = path.join(outDir, "bgSpiral.svg");

  fs.writeFileSync(outPath, svg, "utf8");

  console.log("Wrote bgSpiral.svg →", outPath);
  console.log("  size:", bytes, "bytes");
  console.log("  style:", style.name);
  console.log("  mode:", style.mode);
  console.log("  detail:", detail);
  console.log("  palette:", palette);
  console.log("  target <=:", TARGET_BYTES, "bytes");
}

main();