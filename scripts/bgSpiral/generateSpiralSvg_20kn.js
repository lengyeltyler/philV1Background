import fs from "fs";
import path from "path";
import { keccak256, toUtf8Bytes } from "ethers";

const WIDTH = 420;
const HEIGHT = 420;
const TARGET_BYTES = 20 * 1024;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

const MODE_CONFIG = {
  butterfly: { start: 220, min: 70, step: 18 },
  lissajousWeb: { start: 200, min: 80, step: 16 },
  phyllotaxisBloom: { start: 190, min: 90, step: 16 },
  spiralLattice: { start: 200, min: 110, step: 16 },
  ribbonBraid: { start: 190, min: 90, step: 16 },
  helicalSpring: { start: 200, min: 110, step: 16 },
  fractalFlake: { start: 180, min: 90, step: 16 },
  orbitConstellation: { start: 190, min: 100, step: 16 },
  strangeAttractor: { start: 200, min: 90, step: 16 },
  voronoiSwarm: { start: 200, min: 100, step: 16 },
  planarHarmonic: { start: 190, min: 90, step: 16 },
  magneticField: { start: 200, min: 100, step: 16 },
  foldedRibbon: { start: 190, min: 90, step: 16 },
  particleDrift: { start: 190, min: 90, step: 16 },
};

const INTRICATE_MODES = [
  "lissajousWeb",
  "phyllotaxisBloom",
  "spiralLattice",
  "ribbonBraid",
  "helicalSpring",
  "fractalFlake",
  "orbitConstellation",
  "strangeAttractor",
  "voronoiSwarm",
  "planarHarmonic",
  "magneticField",
  "foldedRibbon",
  "particleDrift",
];

const DEFAULTS = {
  count: 1 + INTRICATE_MODES.length,
  outDir: path.join(process.cwd(), "output", "spirals"),
  seedOffset: "0",
  butterflyCount: 1,
  startId: 0,
};

class Rng {
  constructor(seedHex) {
    const bytes = Buffer.from(seedHex.slice(2), "hex");
    this.a = bytes.readUInt32BE(0);
    this.b = bytes.readUInt32BE(4);
    this.c = bytes.readUInt32BE(8);
    this.d = bytes.readUInt32BE(12);
  }

  next() {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;

    let t = (this.a + this.b) | 0;
    t = (t + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = ((this.c << 21) | (this.c >>> 11));
    this.c = (this.c + t) | 0;

    return ((t >>> 0) / 0x1_0000_0000);
  }

  float(min = 0, max = 1) {
    return min + (max - min) * this.next();
  }

  int(min, max) {
    if (max < min) [min, max] = [max, min];
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice(arr) {
    return arr[this.int(0, arr.length - 1)];
  }
}

function deriveSeed(...parts) {
  const data = toUtf8Bytes(parts.map((p) => String(p)).join("|"));
  return keccak256(data);
}

function fmt1(n) {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function clampSegments(value, { min = 12, max = 22 } = {}) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

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

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function generatePalette(seedHex) {
  const rng = new Rng(seedHex);
  const colorCount = rng.int(1, 3);
  const baseHue = rng.float(0, 360);
  const colors = [];

  for (let i = 0; i < colorCount; i++) {
    const hue = (baseHue + rng.float(25, 160) + i * 37) % 360;
    const sat = 55 + rng.float(-5, 25);
    const light = 38 + rng.float(0, 24);
    colors.push(hslToHex(hue, sat, light));
  }

  return {
    hex: colors,
    rgb: colors.map(hexToRgb),
  };
}

function blendPalette(palette, t) {
  if (palette.rgb.length === 1) {
    return palette.hex[0];
  }

  const scaled = clamp01(t) * (palette.rgb.length - 1);
  const idx = Math.min(palette.rgb.length - 2, Math.floor(scaled));
  const frac = scaled - idx;
  const a = palette.rgb[idx];
  const b = palette.rgb[idx + 1];

  return rgbToHex({
    r: Math.round(lerp(a.r, b.r, frac)),
    g: Math.round(lerp(a.g, b.g, frac)),
    b: Math.round(lerp(a.b, b.b, frac)),
  });
}

function seededNoise(colorSeed, index) {
  const hash = keccak256(toUtf8Bytes(`${colorSeed}|${index}`));
  const value = parseInt(hash.slice(2, 10), 16);
  return value / 0xffffffff;
}

function splitPolyline(points, targetSegments) {
  if (points.length < 2) return [];
  const safeSegments = Math.max(1, Math.min(targetSegments, points.length - 1));
  const segments = [];
  let cursor = 0;

  for (let i = 0; i < safeSegments; i++) {
    const remainingSegments = safeSegments - i;
    const remainingPoints = points.length - cursor;
    const len = i === safeSegments - 1 ? remainingPoints : Math.max(2, Math.floor(remainingPoints / remainingSegments));
    const chunk = points.slice(cursor, cursor + len);
    if (chunk.length >= 2) segments.push(chunk);
    cursor += len - 1;
  }

  return segments;
}

function pointsToPath(points) {
  if (!points.length) return "";
  let d = `M${fmt1(points[0].x)} ${fmt1(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    d += `L${fmt1(points[i].x)} ${fmt1(points[i].y)}`;
  }
  return d;
}

function formatOpacity(value) {
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function polylineToSegments({ points, segments, palette, strokeWidth, dashArray, opacity, colorSeed }) {
  const chunks = splitPolyline(points, segments);
  const out = [];

  const total = chunks.length;
  chunks.forEach((chunk, index) => {
    const baseT = total <= 1 ? 0.5 : index / (total - 1);
    const noise = seededNoise(colorSeed, index) - 0.5;
    const colorMix = clamp01(baseT + noise * 0.12);
    const stroke = blendPalette(palette, colorMix);
    const d = pointsToPath(chunk);
    let attr = `d="${d}" fill="none" stroke="${stroke}" stroke-width="${fmt1(strokeWidth)}" stroke-linecap="round" opacity="${formatOpacity(opacity)}"`;
    if (dashArray) attr += ` stroke-dasharray="${dashArray}"`;
    out.push(`<path ${attr}/>`);
  });

  return out;
}

function shrinkPolyline(points, factor) {
  return points.map((p) => ({
    x: CENTER_X + (p.x - CENTER_X) * factor,
    y: CENTER_Y + (p.y - CENTER_Y) * factor,
  }));
}

function mirrorPointsHoriz(points) {
  return points.map((p) => ({
    x: p.x,
    y: CENTER_Y - (p.y - CENTER_Y),
  }));
}

function rotatePolyline(points, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map((p) => {
    const dx = p.x - CENTER_X;
    const dy = p.y - CENTER_Y;
    return {
      x: CENTER_X + dx * cos - dy * sin,
      y: CENTER_Y + dx * sin + dy * cos,
    };
  });
}

function buildSpiralArmPoints({ detail, armIndex, arms, turns, wobble, radiusScale = 1, phase = 0, taper = 1 }) {
  const pts = [];
  const samples = Math.max(2, detail);
  const maxRadius = WIDTH * 0.45 * radiusScale;

  for (let i = 0; i < samples; i++) {
    const t = samples === 1 ? 0 : i / (samples - 1);
    const radius = Math.pow(t, taper) * maxRadius;
    const twist = Math.sin(t * Math.PI * 2) * wobble;
    const baseAngle = (armIndex / arms) * Math.PI * 2;
    const angle = baseAngle + phase + t * Math.PI * 2 * turns + twist;
    pts.push({
      x: CENTER_X + Math.cos(angle) * radius,
      y: CENTER_Y + Math.sin(angle) * radius,
    });
  }

  return pts;
}

function buildPetalCurvePoints({ detail, petalIndex, petals, innerRadius, outerRadius, curl, twist = 0 }) {
  const pts = [];
  const samples = Math.max(2, detail);
  const baseAngle = (petalIndex / petals) * Math.PI * 2;

  for (let i = 0; i < samples; i++) {
    const t = samples === 1 ? 0 : i / (samples - 1);
    const radius = lerp(innerRadius, outerRadius, Math.sin(t * Math.PI));
    const bend = Math.sin(t * Math.PI) * curl;
    const angle = baseAngle + bend + twist;
    pts.push({
      x: CENTER_X + Math.cos(angle) * radius,
      y: CENTER_Y + Math.sin(angle) * radius,
    });
  }

  return pts;
}

function buildZigzagLegPoints({ steps, legIndex, totalLegs, radius, amplitude, waves }) {
  const pts = [];
  const baseAngle = (legIndex / totalLegs) * Math.PI * 2;
  const samples = Math.max(2, steps);

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const r = 30 + t * radius;
    const perp = baseAngle + Math.PI / 2;
    const wiggle = Math.sin(t * Math.PI * waves + legIndex * 0.35) * amplitude * (0.3 + 0.7 * t);
    const x = CENTER_X + Math.cos(baseAngle) * r + Math.cos(perp) * wiggle;
    const y = CENTER_Y + Math.sin(baseAngle) * r + Math.sin(perp) * wiggle;
    pts.push({ x, y });
  }

  return pts;
}

function buildStarSpikePoints({ steps, spikeIndex, totalSpikes, innerRadius, outerRadius, wobble }) {
  const pts = [];
  const angle = (spikeIndex / totalSpikes) * Math.PI * 2;
  const samples = Math.max(2, steps);

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const radius = lerp(innerRadius, outerRadius, Math.pow(t, 0.85));
    const ripple = Math.sin(t * Math.PI * 3 + angle) * wobble * (0.3 + 0.7 * t);
    pts.push({
      x: CENTER_X + Math.cos(angle) * (radius + ripple),
      y: CENTER_Y + Math.sin(angle) * (radius + ripple),
    });
  }

  return pts;
}

function buildButterflyVariant({ rng, detail }) {
  const pointsPerWing = Math.max(70, detail);
  const baseWidth = 150 + rng.float(-10, 36);
  const innerWidth = baseWidth * (0.7 + rng.float(0, 0.08));
  const baseHeight = 150 + rng.float(-8, 22);
  const lobeCount = 3 + rng.int(0, 2);
  const seamPower = 0.75 + rng.float(0, 0.15);
  const bodyHalf = 18 + rng.float(-2, 4);
  const dualSymmetry = rng.next() > 0.58;

  const wings = [];
  const layers = [
    { name: "outer", width: baseWidth, height: baseHeight, lobe: 26 + rng.float(0, 10), dash: `0 ${fmt1(5.6 + rng.float(-0.4, 0.8))}`, stroke: 2.4, opacity: 0.9 },
    { name: "inner", width: innerWidth, height: baseHeight * 0.85, lobe: 20 + rng.float(0, 8), dash: `0 ${fmt1(4.8 + rng.float(-0.4, 0.6))}`, stroke: 1.8, opacity: 0.85 },
  ];

  layers.forEach((layer) => {
    for (const side of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= pointsPerWing; i++) {
        const t = i / pointsPerWing;
        const heightCurve = Math.sin((t - 0.5) * Math.PI) * layer.height * 0.8;
        const ripple = Math.sin(t * Math.PI * (lobeCount + (layer.name === "outer" ? 0 : 0.5))) * layer.lobe;
        const seam = Math.pow(t, seamPower) * layer.width;
        const y = CENTER_Y + heightCurve + Math.sin(t * Math.PI * 2) * (side > 0 ? 9 : -7);
        const x = CENTER_X + side * (bodyHalf + seam + ripple);
        pts.push({ x, y });
      }

      wings.push({
        id: `${layer.name}-${side > 0 ? "R" : "L"}`,
        points: pts,
        strokeWidth: layer.stroke,
        dashArray: layer.dash,
        opacity: layer.opacity,
        segments: clampSegments(pointsPerWing / 12, { min: 12, max: 16 }),
      });

    }
  });

  const veinCount = 1;
  for (let v = 0; v < veinCount; v++) {
    const offset = (v + 1) / (veinCount + 1);
    const samples = Math.floor(pointsPerWing * 0.6);
    for (const side of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const spread = bodyHalf + offset * innerWidth * 0.9;
        const y = CENTER_Y - baseHeight * 0.4 + t * baseHeight * 0.8 + Math.sin(t * Math.PI * 1.6 + offset) * 10;
        const curl = Math.sin(t * Math.PI * 1.1 + offset * 2) * 18;
        const x = CENTER_X + side * (spread * easeInOut(t) + curl * (1 - t));
        pts.push({ x, y });
      }

      wings.push({
        id: `vein-${v}-${side > 0 ? "R" : "L"}`,
        points: pts,
        strokeWidth: 1.4,
        dashArray: `0 ${fmt1(3.6 + v * 0.2)}`,
        opacity: 0.92,
        segments: clampSegments(pointsPerWing / 14, { min: 12, max: 16 }),
      });
    }
  }

  if (dualSymmetry) {
    const veilPts = [];
    const veilSamples = Math.max(40, Math.floor(pointsPerWing * 0.4));
    for (let i = 0; i <= veilSamples; i++) {
      const t = i / veilSamples;
      const angle = (t - 0.5) * Math.PI;
      const radius = bodyHalf + Math.sin(t * Math.PI) * innerWidth * 0.8;
      const x = CENTER_X + Math.cos(angle) * radius;
      const y = CENTER_Y - baseHeight * 0.4 + Math.sin(angle) * baseHeight * 0.45;
      veilPts.push({ x, y });
    }

    const mirrored = mirrorPointsHoriz(veilPts).slice().reverse();
    const combined = veilPts.concat(mirrored);
    wings.push({
      id: "veil-band",
      points: combined,
      strokeWidth: 1.3,
      dashArray: `0 ${fmt1(3.8)}`,
      opacity: 0.75,
      segments: clampSegments(combined.length / 8, { min: 12, max: 16 }),
    });
  }

  const bodyPts = [];
  const bodySamples = Math.max(40, Math.floor(pointsPerWing * 0.4));
  for (let i = 0; i <= bodySamples; i++) {
    const t = i / bodySamples;
    const y = CENTER_Y - baseHeight * 0.5 + t * baseHeight;
    const wobble = Math.sin(t * Math.PI * 3) * 3;
    bodyPts.push({ x: CENTER_X + Math.sin(t * Math.PI) * 2 + wobble, y });
  }

  wings.push({
    id: "body",
    points: bodyPts,
    strokeWidth: 2.5,
    dashArray: "0 2.9",
    opacity: 0.95,
    segments: clampSegments(bodySamples / 3.5, { min: 12, max: 16 }),
  });

  return { paths: wings };
}

function buildLissajousVariant({ rng, detail }) {
  const loops = 3;
  const freqA = 2 + rng.int(0, 2);
  const freqB = 3 + rng.int(0, 2);
  const radiusX = 120 + rng.float(-15, 25);
  const radiusY = 150 + rng.float(-10, 30);
  const delta = rng.float(0, Math.PI);
  const samples = Math.max(60, Math.floor(detail * 0.6));
  const paths = [];
  const loopSets = [];

  for (let loop = 0; loop < loops; loop++) {
    const rot = (loop / loops) * Math.PI * 2;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const lx = Math.sin(freqA * t + delta) * radiusX;
      const ly = Math.sin(freqB * t) * radiusY;
      const x = CENTER_X + lx * Math.cos(rot) - ly * Math.sin(rot);
      const y = CENTER_Y + lx * Math.sin(rot) + ly * Math.cos(rot);
      pts.push({ x, y });
    }
    loopSets.push(pts);
    paths.push({
      id: `lissa-loop-${loop}`,
      points: pts,
      strokeWidth: 2.0,
      dashArray: `0 ${fmt1(5 + (loop % 2) * 0.3)}`,
      opacity: 0.88,
      segments: clampSegments(samples / 14, { min: 12, max: 18 }),
    });

    if (loop % 2 === 0) {
      const echo = shrinkPolyline(pts, 0.85 + rng.float(0, 0.05));
      paths.push({
        id: `lissa-echo-${loop}`,
        points: rotatePolyline(echo, (loop % 2 === 0 ? 1 : -1) * 0.08),
        strokeWidth: 1.5,
        dashArray: `0 ${fmt1(4.2 + (loop % 3) * 0.2)}`,
        opacity: 0.78,
        segments: clampSegments(samples / 16, { min: 12, max: 16 }),
      });
    }
  }

  const baseLoop = loopSets[0] || [];
  const chords = Math.min(6, Math.floor(samples / 12));
  for (let c = 0; c < chords; c++) {
    if (!baseLoop.length) break;
    const idx = Math.floor((c / chords) * (baseLoop.length - 1));
    const hop = (idx + Math.floor(baseLoop.length / 2.5)) % baseLoop.length;
    const mid = {
      x: (baseLoop[idx].x + baseLoop[hop].x) / 2 + Math.sin(c) * 6,
      y: (baseLoop[idx].y + baseLoop[hop].y) / 2 + Math.cos(c * 0.6) * 6,
    };
    const chordPts = [baseLoop[idx], mid, baseLoop[hop]];
    paths.push({
      id: `lissa-chord-${c}`,
      points: chordPts,
      strokeWidth: 1.1,
      dashArray: `0 ${fmt1(3.6 + (c % 3) * 0.2)}`,
      opacity: 0.72,
      segments: clampSegments(chordPts.length, { min: 12, max: 14 }),
    });
  }

  const radialBands = 4;
  for (let r = 0; r < radialBands; r++) {
    const angle = (r / radialBands) * Math.PI * 2;
    const steps = 6;
    const radialPts = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const radius = t * WIDTH * 0.42 + Math.sin(t * Math.PI * 2 + r) * 10;
      radialPts.push({
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius,
      });
    }
    paths.push({
      id: `lissa-radial-${r}`,
      points: radialPts,
      strokeWidth: 1.0,
      dashArray: r % 2 === 0 ? `0 ${fmt1(3.4 + (r % 3) * 0.2)}` : undefined,
      opacity: 0.7,
      segments: clampSegments(radialPts.length, { min: 12, max: 14 }),
    });
  }

  return { paths };
}

function buildPhyllotaxisVariant({ rng, detail }) {
  const seeds = Math.max(90, Math.floor(detail * 0.8));
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const scale = 6.4 + rng.float(-0.5, 0.8);
  const stretchX = 1.5 + rng.float(-0.1, 0.2);
  const stretchY = 1.1 + rng.float(-0.1, 0.15);
  const petals = 6 + rng.int(0, 3);
  const paths = [];
  const points = [];

  for (let n = 0; n < seeds; n++) {
    const r = Math.sqrt(n + 0.5) * scale;
    const theta = n * goldenAngle;
    points.push({
      x: CENTER_X + Math.cos(theta) * r * stretchX,
      y: CENTER_Y + Math.sin(theta) * r * stretchY,
    });
  }

  paths.push({
    id: "phyllo-spiral",
    points,
    strokeWidth: 2.0,
    dashArray: `0 ${fmt1(5 + rng.float(-0.2, 0.4))}`,
    opacity: 0.86,
    segments: clampSegments(points.length / 14, { min: 12, max: 18 }),
  });

  for (let p = 0; p < petals; p++) {
    const subset = [];
    for (let idx = p; idx < points.length; idx += petals) {
      subset.push(points[idx]);
    }
    if (subset.length < 2) continue;
    paths.push({
      id: `phyllo-petal-${p}`,
      points: subset,
      strokeWidth: 1.4,
      dashArray: `0 ${fmt1(4.2 + (p % 3) * 0.2)}`,
      opacity: 0.78,
      segments: clampSegments(subset.length / 10, { min: 12, max: 16 }),
    });
  }

  const ringSamples = 48;
  const ringPts = [];
  const ringRadius = Math.sqrt(seeds) * scale * 0.9;
  for (let i = 0; i <= ringSamples; i++) {
    const t = i / ringSamples;
    const angle = t * Math.PI * 2;
    const ripple = Math.sin(angle * petals + rng.float(0, Math.PI)) * 6;
    ringPts.push({
      x: CENTER_X + Math.cos(angle) * (ringRadius + ripple),
      y: CENTER_Y + Math.sin(angle) * (ringRadius + ripple),
    });
  }
  paths.push({
    id: "phyllo-ring",
    points: ringPts,
    strokeWidth: 1.2,
    dashArray: `0 ${fmt1(3.6)}`,
    opacity: 0.74,
    segments: clampSegments(ringSamples / 6, { min: 12, max: 16 }),
  });

  const bridgeCount = 6;
  for (let b = 0; b < bridgeCount; b++) {
    const idx = Math.floor((b / bridgeCount) * (points.length - 1));
    const next = (idx + Math.floor(points.length / 8)) % points.length;
    const mid = {
      x: (points[idx].x + points[next].x) / 2 + Math.sin(b) * 5,
      y: (points[idx].y + points[next].y) / 2 + Math.cos(b * 0.7) * 5,
    };
    const bridgePts = [points[idx], mid, points[next]];
    paths.push({
      id: `phyllo-bridge-${b}`,
      points: bridgePts,
      strokeWidth: 1.0,
      dashArray: b % 2 === 0 ? `0 ${fmt1(3.4 + (b % 3) * 0.2)}` : undefined,
      opacity: 0.7,
      segments: clampSegments(bridgePts.length, { min: 12, max: 14 }),
    });
  }

  return { paths };
}

function buildSpiralLatticeVariant({ rng, detail }) {
  const turns = 3.5 + rng.float(0, 1.6);
  const wobble = 0.12 + rng.float(0, 0.12);
  const samples = Math.max(120, Math.floor(detail));
  const base = buildSpiralArmPoints({
    detail: samples,
    armIndex: 0,
    arms: 1,
    turns,
    wobble,
    taper: 1.05,
  });
  const offset = buildSpiralArmPoints({
    detail: samples,
    armIndex: 0,
    arms: 1,
    turns: turns + 0.4,
    wobble: wobble * 0.9,
    phase: Math.PI / 2,
    radiusScale: 0.9,
    taper: 0.95,
  });
  const paths = [];

  paths.push({
    id: "lattice-main",
    points: base,
    strokeWidth: 2.0,
    dashArray: `0 ${fmt1(5 + rng.float(-0.2, 0.4))}`,
    opacity: 0.86,
    segments: clampSegments(samples / 14, { min: 12, max: 18 }),
  });

  paths.push({
    id: "lattice-offset",
    points: offset,
    strokeWidth: 1.6,
    dashArray: `0 ${fmt1(4.4 + rng.float(-0.2, 0.4))}`,
    opacity: 0.8,
    segments: clampSegments(samples / 16, { min: 12, max: 16 }),
  });

  const rungs = 10;
  for (let r = 0; r < rungs; r++) {
    const t = r / (rungs - 1);
    const idx = Math.floor(t * (base.length - 1));
    const opposite = Math.max(0, base.length - 1 - idx);
    const rungPts = [
      base[idx],
      {
        x: CENTER_X + Math.cos(t * Math.PI * 4) * 12,
        y: CENTER_Y + Math.sin(t * Math.PI * 4) * 12,
      },
      offset[opposite],
    ];
    paths.push({
      id: `lattice-rung-${r}`,
      points: rungPts,
      strokeWidth: 1.2,
      dashArray: `0 ${fmt1(3.8 + (r % 3) * 0.2)}`,
      opacity: 0.72,
      segments: clampSegments(rungPts.length, { min: 12, max: 14 }),
    });
  }

  const radialCount = 5;
  for (let i = 0; i < radialCount; i++) {
    const angle = (i / radialCount) * Math.PI * 2;
    const radialPts = [];
    const radialSteps = 6;
    for (let j = 0; j <= radialSteps; j++) {
      const t = j / radialSteps;
      const radius = t * WIDTH * 0.4 + Math.sin(t * Math.PI * 3 + i) * 8;
      radialPts.push({
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius,
      });
    }
    paths.push({
      id: `lattice-radial-${i}`,
      points: radialPts,
      strokeWidth: 1.0,
      dashArray: i % 2 === 0 ? `0 ${fmt1(3.4 + (i % 3) * 0.2)}` : undefined,
      opacity: 0.68,
      segments: clampSegments(radialPts.length, { min: 12, max: 14 }),
    });
  }

  return { paths };
}

function buildRibbonBraidVariant({ rng, detail }) {
  const ribbons = 3;
  const samples = Math.max(90, Math.floor(detail * 0.8));
  const baseRadius = 110 + rng.float(-12, 18);
  const amplitude = 24 + rng.float(0, 12);
  const freq = 3 + rng.int(0, 2);
  const paths = [];

  for (let r = 0; r < ribbons; r++) {
    const offset = (r / ribbons) * Math.PI * 2;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const angle = t * Math.PI * 2 + offset;
      const warp = Math.sin(angle * freq + r) * amplitude;
      const radial = baseRadius + warp;
      const x = CENTER_X + Math.cos(angle) * radial + Math.sin(angle * 2 + offset) * 6;
      const y = CENTER_Y + Math.sin(angle) * radial + Math.cos(angle * 1.5 + offset) * 6;
      pts.push({ x, y });
    }
    paths.push({
      id: `ribbon-${r}-main`,
      points: pts,
      strokeWidth: 2.0,
      dashArray: `0 ${fmt1(5 + (r % 2) * 0.3)}`,
      opacity: 0.86,
      segments: clampSegments(samples / 16, { min: 12, max: 18 }),
    });

    const edge = shrinkPolyline(pts, 0.9);
    paths.push({
      id: `ribbon-${r}-edge`,
      points: rotatePolyline(edge, (r % 2 === 0 ? 1 : -1) * 0.05),
      strokeWidth: 1.4,
      dashArray: `0 ${fmt1(4.3 + (r % 3) * 0.2)}`,
      opacity: 0.78,
      segments: clampSegments(samples / 18, { min: 12, max: 16 }),
    });
  }

  const ties = 4;
  for (let t = 0; t < ties; t++) {
    const angle = (t / ties) * Math.PI * 2;
    const tiePts = [];
    const tieSteps = 4;
    for (let i = 0; i <= tieSteps; i++) {
      const mix = i / tieSteps;
      const radius = 40 + mix * WIDTH * 0.35 + Math.sin(mix * Math.PI * 3 + t) * 8;
      tiePts.push({
        x: CENTER_X + Math.cos(angle + mix * 0.4) * radius,
        y: CENTER_Y + Math.sin(angle + mix * 0.4) * radius,
      });
    }
    paths.push({
      id: `ribbon-tie-${t}`,
      points: tiePts,
      strokeWidth: 1.1,
      dashArray: t % 2 === 0 ? `0 ${fmt1(3.5 + (t % 3) * 0.2)}` : undefined,
      opacity: 0.72,
      segments: clampSegments(tiePts.length, { min: 12, max: 14 }),
    });
  }

  return { paths };
}

function buildHelicalSpringVariant({ rng, detail }) {
  const springs = 2 + rng.int(0, 1);
  const samples = Math.max(90, Math.floor(detail * 0.85));
  const turns = 4 + rng.float(0, 1.6);
  const amplitude = 16 + rng.float(0, 8);
  const paths = [];

  for (let s = 0; s < springs; s++) {
    const baseAngle = (s / springs) * Math.PI * 2;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const radius = 30 + t * WIDTH * 0.42;
      const wiggle = Math.sin(t * Math.PI * turns + s) * amplitude;
      const angle = baseAngle + Math.sin(t * Math.PI * turns) * 0.3;
      const x = CENTER_X + Math.cos(angle) * (radius + wiggle);
      const y = CENTER_Y + Math.sin(angle) * (radius - wiggle);
      pts.push({ x, y });
    }
    paths.push({
      id: `spring-${s}-main`,
      points: pts,
      strokeWidth: 1.9,
      dashArray: `0 ${fmt1(5 + (s % 2) * 0.3)}`,
      opacity: 0.86,
      segments: clampSegments(samples / 14, { min: 12, max: 18 }),
    });

    const shadow = shrinkPolyline(pts, 0.92);
    paths.push({
      id: `spring-${s}-shadow`,
      points: shadow,
      strokeWidth: 1.2,
      dashArray: `0 ${fmt1(4.0 + (s % 3) * 0.2)}`,
      opacity: 0.74,
      segments: clampSegments(samples / 18, { min: 12, max: 16 }),
    });
  }

  const braces = 6;
  for (let b = 0; b < braces; b++) {
    const angle = (b / braces) * Math.PI * 2;
    const bracePts = [];
    const braceSteps = 5;
    for (let i = 0; i <= braceSteps; i++) {
      const t = i / braceSteps;
      const radius = 20 + t * WIDTH * 0.35 + Math.sin(t * Math.PI * 4 + b) * 6;
      bracePts.push({
        x: CENTER_X + Math.cos(angle + t * 0.3) * radius,
        y: CENTER_Y + Math.sin(angle + t * 0.3) * radius,
      });
    }
    paths.push({
      id: `spring-brace-${b}`,
      points: bracePts,
      strokeWidth: 1.0,
      dashArray: b % 2 === 0 ? `0 ${fmt1(3.4 + (b % 3) * 0.2)}` : undefined,
      opacity: 0.7,
      segments: clampSegments(bracePts.length, { min: 12, max: 14 }),
    });
  }

  return { paths };
}

function buildFractalFlakeVariant({ rng, detail }) {
  const spikes = 5 + rng.int(0, 3);
  const outerRadius = WIDTH * 0.38;
  const innerRadius = 26 + rng.float(0, 10);
  const steps = Math.max(40, Math.floor(detail * 0.6));
  const paths = [];

  for (let s = 0; s < spikes; s++) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const radius = lerp(innerRadius, outerRadius, Math.pow(t, 0.85));
      const ripple = Math.sin(t * Math.PI * 4 + s) * 10;
      const angle = (s / spikes) * Math.PI * 2 + Math.sin(t * Math.PI) * 0.25;
      pts.push({
        x: CENTER_X + Math.cos(angle) * (radius + ripple),
        y: CENTER_Y + Math.sin(angle) * (radius + ripple),
      });
    }
    paths.push({
      id: `flake-spike-${s}`,
      points: pts,
      strokeWidth: 1.8,
      dashArray: `0 ${fmt1(5 + (s % 2) * 0.3)}`,
      opacity: 0.85,
      segments: clampSegments(steps / 8, { min: 12, max: 18 }),
    });

    const branchCount = rng.next() > 0.5 ? 1 : 0;
    for (let b = 1; b <= branchCount; b++) {
      const branchIdx = Math.floor((b / (branchCount + 1)) * (pts.length - 1));
      const base = pts[branchIdx];
      const tip = {
        x: CENTER_X + (base.x - CENTER_X) * 0.7 + Math.cos(base.y) * 6,
        y: CENTER_Y + (base.y - CENTER_Y) * 0.7 + Math.sin(base.x) * 6,
      };
      paths.push({
        id: `flake-branch-${s}-${b}`,
        points: [base, tip],
        strokeWidth: 1.1,
        dashArray: `0 ${fmt1(3.4 + b * 0.2)}`,
        opacity: 0.72,
        segments: 12,
      });
    }
  }

  const haloSamples = 40;
  const haloPts = [];
  for (let i = 0; i <= haloSamples; i++) {
    const t = i / haloSamples;
    const angle = t * Math.PI * 2;
    const radius = innerRadius * 0.8 + Math.sin(angle * spikes) * 8;
    haloPts.push({
      x: CENTER_X + Math.cos(angle) * radius,
      y: CENTER_Y + Math.sin(angle) * radius,
    });
  }
  paths.push({
    id: "flake-halo",
    points: haloPts,
    strokeWidth: 1.2,
    dashArray: `0 ${fmt1(3.6)}`,
    opacity: 0.74,
    segments: clampSegments(haloSamples / 6, { min: 12, max: 16 }),
  });

  return { paths };
}

function buildOrbitConstellationVariant({ rng, detail }) {
  const orbitCount = 4 + rng.int(0, 2);
  const samples = Math.max(100, Math.floor(detail * 0.9));
  const paths = [];
  const nodes = [];

  for (let o = 0; o < orbitCount; o++) {
    const radius = 40 + o * 35;
    const eccentricity = 0.12 + rng.float(0, 0.25);
    const tilt = rng.float(0, Math.PI);
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const angle = t * Math.PI * 2;
      const r = radius * (1 + eccentricity * Math.cos(angle * 2 + tilt));
      const x = CENTER_X + Math.cos(angle + tilt) * r;
      const y = CENTER_Y + Math.sin(angle + tilt) * r * (1 - 0.2 * eccentricity);
      pts.push({ x, y });
      if (i % Math.floor(samples / 6) === 0) nodes.push({ x, y });
    }
    paths.push({
      id: `orbit-${o}`,
      points: pts,
      strokeWidth: 1.6,
      dashArray: `0 ${fmt1(4.6 + (o % 3) * 0.2)}`,
      opacity: 0.82,
      segments: clampSegments(samples / 14, { min: 12, max: 18 }),
    });
  }

  const linkCount = Math.min(8, nodes.length - 1);
  for (let i = 0; i < linkCount; i++) {
    const a = nodes[i];
    const b = nodes[(i + 5) % nodes.length];
    const mid = {
      x: (a.x + b.x) / 2 + Math.sin(i) * 5,
      y: (a.y + b.y) / 2 + Math.cos(i * 0.6) * 5,
    };
    paths.push({
      id: `orbit-link-${i}`,
      points: [a, mid, b],
      strokeWidth: 1.0,
      dashArray: i % 2 === 0 ? `0 ${fmt1(3.3 + (i % 3) * 0.2)}` : undefined,
      opacity: 0.7,
      segments: clampSegments(3, { min: 12, max: 14 }),
    });
  }

  const spokes = 4;
  for (let s = 0; s < spokes; s++) {
    const angle = (s / spokes) * Math.PI * 2;
    const spokePts = [];
    const spokeSteps = 5;
    for (let i = 0; i <= spokeSteps; i++) {
      const t = i / spokeSteps;
      const radius = 20 + t * WIDTH * 0.4 + Math.sin(t * Math.PI * 2 + s) * 6;
      spokePts.push({
        x: CENTER_X + Math.cos(angle + t * 0.2) * radius,
        y: CENTER_Y + Math.sin(angle + t * 0.2) * radius,
      });
    }
    paths.push({
      id: `orbit-spoke-${s}`,
      points: spokePts,
      strokeWidth: 1.1,
      dashArray: `0 ${fmt1(3.5 + (s % 3) * 0.2)}`,
      opacity: 0.72,
      segments: clampSegments(spokePts.length, { min: 12, max: 14 }),
    });
  }

  return { paths };
}

function buildStrangeAttractorVariant({ rng, detail }) {
  const steps = Math.max(400, Math.floor(detail * 3));
  const a = -1.4 + rng.float(-0.2, 0.2);
  const b = 1.6 + rng.float(-0.2, 0.2);
  const c = 1.0 + rng.float(-0.2, 0.2);
  const d = 0.7 + rng.float(-0.2, 0.2);
  let x = 0.1;
  let y = 0.1;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const nx = Math.sin(a * y) + c * Math.cos(a * x);
    const ny = Math.sin(b * x) + d * Math.cos(b * y);
    x = nx;
    y = ny;
    if (i < 50) continue;
    const scaledX = CENTER_X + x * 90;
    const scaledY = CENTER_Y + y * 90;
    pts.push({ x: scaledX, y: scaledY });
  }

  const mirrored = pts.filter((_, i) => i % 2 === 0).map((p) => ({ x: WIDTH - p.x, y: p.y }));
  const paths = [
    {
      id: "attractor-main",
      points: pts,
      strokeWidth: 1.6,
      dashArray: `0 ${fmt1(4.6)}`,
      opacity: 0.85,
      segments: clampSegments(pts.length / 40, { min: 12, max: 16 }),
    },
    {
      id: "attractor-mirror",
      points: mirrored,
      strokeWidth: 1.2,
      dashArray: `0 ${fmt1(3.8)}`,
      opacity: 0.72,
      segments: clampSegments(mirrored.length / 40, { min: 12, max: 16 }),
    },
  ];

  const loopSamples = 60;
  const loopPts = [];
  for (let i = 0; i <= loopSamples; i++) {
    const t = i / loopSamples;
    const angle = t * Math.PI * 2;
    const radius = 30 + Math.sin(angle * 6) * 6;
    loopPts.push({
      x: CENTER_X + Math.cos(angle) * radius,
      y: CENTER_Y + Math.sin(angle) * radius,
    });
  }
  paths.push({
    id: "attractor-loop",
    points: loopPts,
    strokeWidth: 1.0,
    dashArray: `0 ${fmt1(3.4)}`,
    opacity: 0.68,
    segments: clampSegments(loopSamples / 6, { min: 12, max: 16 }),
  });

  return { paths };
}

function buildVoronoiSwarmVariant({ rng, detail }) {
  const rings = 2;
  const points = [];
  for (let r = 1; r <= rings; r++) {
    const count = 6 + r * 2;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng.float(-0.05, 0.05);
      const radius = r * WIDTH * 0.1 + rng.float(-5, 5);
      points.push({
        angle,
        radius,
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius,
      });
    }
  }

  points.sort((a, b) => a.angle - b.angle);
  const limited = points.slice(0, 12);
  const paths = [];
  const segments = Math.max(10, Math.floor(detail / 10));
  for (let i = 0; i < limited.length; i++) {
    const next = limited[(i + 1) % limited.length];
    const poly = [];
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const radius = lerp(points[i].radius, next.radius, t) + Math.sin(t * Math.PI) * 10;
      const angle = lerp(points[i].angle, next.angle, t);
      poly.push({
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius,
      });
    }
    paths.push({
      id: `voronoi-cell-${i}`,
      points: poly,
      strokeWidth: 1.3,
      dashArray: `0 ${fmt1(3.8 + (i % 3) * 0.3)}`,
      opacity: 0.78,
      segments: clampSegments(poly.length / 3, { min: 12, max: 14 }),
    });
  }

  const radialCount = 4;
  for (let r = 0; r < radialCount; r++) {
    const angle = (r / radialCount) * Math.PI * 2;
    const radialPts = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const radius = 20 + t * WIDTH * 0.38 + Math.sin(t * Math.PI * 4 + r) * 6;
      radialPts.push({
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius,
      });
    }
    paths.push({
      id: `voronoi-radial-${r}`,
      points: radialPts,
      strokeWidth: 1.0,
      dashArray: r % 2 === 0 ? `0 ${fmt1(3.4 + (r % 3) * 0.2)}` : undefined,
      opacity: 0.68,
      segments: clampSegments(radialPts.length, { min: 12, max: 14 }),
    });
  }

  return { paths };
}

function buildPlanarHarmonicVariant({ rng, detail }) {
  const harmonics = 3;
  const weights = Array.from({ length: harmonics }, () => rng.float(0.3, 1));
  const phases = Array.from({ length: harmonics }, () => rng.float(0, Math.PI * 2));
  const samples = Math.max(160, Math.floor(detail * 1.2));
  const baseRadius = 40 + rng.float(0, 20);
  const outerRadius = WIDTH * 0.42;

  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const angle = t * Math.PI * 2;
    let radius = baseRadius;
    for (let h = 0; h < harmonics; h++) {
      radius += Math.sin((h + 1) * angle + phases[h]) * weights[h] * 25;
    }
    radius = Math.max(baseRadius, Math.min(outerRadius, radius));
    pts.push({
      x: CENTER_X + Math.cos(angle) * radius,
      y: CENTER_Y + Math.sin(angle) * radius,
    });
  }

  const paths = [
    {
      id: "harmonic-main",
      points: pts,
      strokeWidth: 2.0,
      dashArray: `0 ${fmt1(5 + rng.float(-0.2, 0.4))}`,
      opacity: 0.86,
      segments: clampSegments(samples / 14, { min: 12, max: 18 }),
    },
    {
      id: "harmonic-echo",
      points: rotatePolyline(shrinkPolyline(pts, 0.85), 0.08),
      strokeWidth: 1.5,
      dashArray: `0 ${fmt1(4.2 + rng.float(-0.2, 0.3))}`,
      opacity: 0.78,
      segments: clampSegments(samples / 16, { min: 12, max: 16 }),
    },
  ];

  const spokes = 6;
  for (let s = 0; s < spokes; s++) {
    const angle = (s / spokes) * Math.PI * 2;
    const steps = 5;
    const spokePts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const radius = lerp(baseRadius, outerRadius, easeInOut(t)) + Math.sin(t * Math.PI * 3 + s) * 6;
      spokePts.push({
        x: CENTER_X + Math.cos(angle + t * 0.4) * radius,
        y: CENTER_Y + Math.sin(angle + t * 0.4) * radius,
      });
    }
    paths.push({
      id: `harmonic-spoke-${s}`,
      points: spokePts,
      strokeWidth: 1.0,
      dashArray: s % 2 === 0 ? `0 ${fmt1(3.4 + (s % 3) * 0.2)}` : undefined,
      opacity: 0.7,
      segments: clampSegments(spokePts.length, { min: 12, max: 14 }),
    });
  }

  return { paths };
}

function buildMagneticFieldVariant({ rng, detail }) {
  const charges = [
    { x: CENTER_X + rng.float(-40, 40), y: CENTER_Y - 30 + rng.float(-20, 20), strength: 1 },
    { x: CENTER_X + rng.float(-40, 40), y: CENTER_Y + 30 + rng.float(-20, 20), strength: -1 },
  ];
  const seedAngles = 8;
  const steps = Math.max(40, Math.floor(detail * 0.5));
  const paths = [];

  const integrate = (x, y, dir) => {
    const pts = [{ x, y }];
    for (let i = 0; i < steps; i++) {
      let fx = 0;
      let fy = 0;
      for (const c of charges) {
        const dx = x - c.x;
        const dy = y - c.y;
        const dist2 = dx * dx + dy * dy + 40;
        fx += (c.strength * dy) / dist2;
        fy += (-c.strength * dx) / dist2;
      }
      const len = Math.max(1e-3, Math.hypot(fx, fy));
      x += (fx / len) * dir * 6;
      y += (fy / len) * dir * 6;
      pts.push({ x, y });
      if (x < -20 || x > WIDTH + 20 || y < -20 || y > HEIGHT + 20) break;
    }
    return pts;
  };

  for (let i = 0; i < seedAngles; i++) {
    const angle = (i / seedAngles) * Math.PI * 2;
    const startX = CENTER_X + Math.cos(angle) * 20;
    const startY = CENTER_Y + Math.sin(angle) * 20;
    const forward = integrate(startX, startY, 1);
    const trimmed = forward.filter((_, idx) => idx % 2 === 0);
    paths.push({
      id: `field-line-${i}`,
      points: trimmed,
      strokeWidth: 1.4,
      dashArray: `0 ${fmt1(4.2 + (i % 3) * 0.2)}`,
      opacity: 0.78,
      segments: clampSegments(trimmed.length / 6, { min: 12, max: 16 }),
    });
  }

  const ringSamples = 50;
  const ringPts = [];
  for (let i = 0; i <= ringSamples; i++) {
    const t = i / ringSamples;
    const angle = t * Math.PI * 2;
    const radius = 18 + Math.sin(angle * 6) * 4;
    ringPts.push({
      x: CENTER_X + Math.cos(angle) * radius,
      y: CENTER_Y + Math.sin(angle) * radius,
    });
  }
  paths.push({
    id: "field-core",
    points: ringPts,
    strokeWidth: 1.1,
    dashArray: `0 ${fmt1(3.4)}`,
    opacity: 0.7,
    segments: clampSegments(ringSamples / 5, { min: 12, max: 16 }),
  });

  return { paths };
}

function buildFoldedRibbonVariant({ rng, detail }) {
  const folds = Math.max(40, Math.floor(detail / 2));
  const maxRadius = WIDTH * 0.42;
  const pts = [];
  let radius = 20;
  let angle = 0;
  for (let i = 0; i < folds; i++) {
    if (i % 2 === 0) {
      radius = Math.min(maxRadius, radius + rng.float(4, 10));
    } else {
      angle += (Math.PI / 6) * (rng.next() > 0.5 ? 1 : -1);
    }
    const x = CENTER_X + Math.cos(angle) * radius;
    const y = CENTER_Y + Math.sin(angle) * radius;
    pts.push({ x, y });
  }

  const mirrored = mirrorPointsHoriz(pts);
  const paths = [
    {
      id: "folded-main",
      points: pts,
      strokeWidth: 2.0,
      dashArray: `0 ${fmt1(4.8)}`,
      opacity: 0.85,
      segments: clampSegments(pts.length / 6, { min: 12, max: 18 }),
    },
    {
      id: "folded-mirror",
      points: mirrored,
      strokeWidth: 1.5,
      dashArray: `0 ${fmt1(4.0)}`,
      opacity: 0.78,
      segments: clampSegments(mirrored.length / 7, { min: 12, max: 16 }),
    },
  ];

  const tabs = 6;
  for (let t = 0; t < tabs; t++) {
    const idx = Math.floor((t / tabs) * (pts.length - 1));
    const base = pts[idx];
    const tip = {
      x: CENTER_X + (base.x - CENTER_X) * 0.8 + rng.float(-8, 8),
      y: CENTER_Y + (base.y - CENTER_Y) * 0.8 + rng.float(-8, 8),
    };
    paths.push({
      id: `folded-tab-${t}`,
      points: [base, tip],
      strokeWidth: 1.1,
      dashArray: `0 ${fmt1(3.2 + (t % 3) * 0.2)}`,
      opacity: 0.7,
      segments: 12,
    });
  }

  return { paths };
}

function buildParticleDriftVariant({ rng, detail }) {
  const particles = 5;
  const steps = Math.max(120, Math.floor(detail));
  const noiseScale = 0.05 + rng.float(0, 0.02);

  const noise = (x, y) => {
    const hash = keccak256(
      toUtf8Bytes(`${Math.floor(x * 10)}|${Math.floor(y * 10)}|${Math.floor(noiseScale * 1e4)}`)
    );
    return (parseInt(hash.slice(2, 8), 16) / 0xffffff) * Math.PI * 2;
  };

  const paths = [];
  for (let p = 0; p < particles; p++) {
    let x = CENTER_X + rng.float(-20, 20);
    let y = CENTER_Y + rng.float(-20, 20);
    const trail = [{ x, y }];
    for (let i = 0; i < steps; i++) {
      const ang = noise(x * noiseScale, y * noiseScale) + Math.sin(i * 0.1 + p);
      x += Math.cos(ang) * 4;
      y += Math.sin(ang) * 4;
      trail.push({ x, y });
    }
    paths.push({
      id: `particle-${p}`,
      points: trail,
      strokeWidth: 1.3,
      dashArray: `0 ${fmt1(4.0 + (p % 2) * 0.2)}`,
      opacity: 0.8,
      segments: clampSegments(trail.length / 8, { min: 12, max: 16 }),
    });
  }

  const haloSamples = 40;
  const haloPts = [];
  for (let i = 0; i <= haloSamples; i++) {
    const t = i / haloSamples;
    const angle = t * Math.PI * 2;
    const radius = 22 + Math.sin(angle * 5) * 4;
    haloPts.push({
      x: CENTER_X + Math.cos(angle) * radius,
      y: CENTER_Y + Math.sin(angle) * radius,
    });
  }
  paths.push({
    id: "particle-halo",
    points: haloPts,
    strokeWidth: 1.0,
    dashArray: `0 ${fmt1(3.4)}`,
    opacity: 0.68,
    segments: clampSegments(haloSamples / 4, { min: 12, max: 16 }),
  });

  return { paths };
}

const MODE_BUILDERS = {
  butterfly: buildButterflyVariant,
  lissajousWeb: buildLissajousVariant,
  phyllotaxisBloom: buildPhyllotaxisVariant,
  spiralLattice: buildSpiralLatticeVariant,
  ribbonBraid: buildRibbonBraidVariant,
  helicalSpring: buildHelicalSpringVariant,
  fractalFlake: buildFractalFlakeVariant,
  orbitConstellation: buildOrbitConstellationVariant,
  strangeAttractor: buildStrangeAttractorVariant,
  voronoiSwarm: buildVoronoiSwarmVariant,
  planarHarmonic: buildPlanarHarmonicVariant,
  magneticField: buildMagneticFieldVariant,
  foldedRibbon: buildFoldedRibbonVariant,
  particleDrift: buildParticleDriftVariant,
};

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    let key = arg.slice(2);
    let value;
    if (key.includes("=")) {
      const parts = key.split("=");
      key = parts[0];
      value = parts[1];
    } else {
      value = argv[i + 1];
      i++;
    }

    switch (key) {
      case "count":
        options.count = Number(value);
        break;
      case "outDir":
        options.outDir = path.isAbsolute(value) ? value : path.join(process.cwd(), value);
        break;
      case "seedOffset":
        options.seedOffset = String(value ?? DEFAULTS.seedOffset);
        break;
      case "butterflyCount":
        options.butterflyCount = Number(value);
        break;
      case "startId":
        options.startId = Number(value);
        break;
      default:
        break;
    }
  }

  options.count = Number.isFinite(options.count) ? Math.max(1, Math.floor(options.count)) : DEFAULTS.count;
  options.butterflyCount = Number.isFinite(options.butterflyCount)
    ? Math.max(0, Math.floor(options.butterflyCount))
    : DEFAULTS.butterflyCount;
  options.butterflyCount = Math.min(options.count, options.butterflyCount);
  options.startId = Number.isFinite(options.startId) ? Math.max(0, Math.floor(options.startId)) : DEFAULTS.startId;

  return options;
}

function pickIntricateMode({ ordinal }) {
  return INTRICATE_MODES[ordinal % INTRICATE_MODES.length];
}

function renderPaths(paths, palette, variantId, mode) {
  let body = `<g id="bgSpiral">`;
  paths.forEach((path) => {
    const colorSeed = `${variantId}-${mode}-${path.id}`;
    body += polylineToSegments({
      points: path.points,
      segments: path.segments,
      palette,
      strokeWidth: path.strokeWidth,
      dashArray: path.dashArray,
      opacity: path.opacity,
      colorSeed,
    }).join("");
  });
  body += `</g>`;
  return body;
}

function buildVariant({ variantId, mode, palette, baseSeed }) {
  const config = MODE_CONFIG[mode];
  let detail = config.start;
  let lastSvg = null;
  let lastBytes = 0;
  let lastDetail = detail;

  while (detail >= config.min) {
    const rng = new Rng(deriveSeed(baseSeed, "geometry"));
    const builder = MODE_BUILDERS[mode];
    const { paths } = builder({ rng, detail });
    const group = renderPaths(paths, palette, variantId, mode);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${group}</svg>`;
    const bytes = Buffer.byteLength(svg, "utf8");

    lastSvg = svg;
    lastBytes = bytes;
    lastDetail = detail;

    if (bytes <= TARGET_BYTES) {
      return { svg, bytes, detail };
    }

    const nextDetail = Math.max(config.min, detail - config.step);
    if (nextDetail === detail) break;
    detail = nextDetail;
  }

  return { svg: lastSvg, bytes: lastBytes, detail: lastDetail };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.outDir)) fs.mkdirSync(args.outDir, { recursive: true });

  for (let i = 0; i < args.count; i++) {
    const variantId = args.startId + i;
    let mode = "butterfly";
    if (i >= args.butterflyCount) {
      const ordinal = i - args.butterflyCount;
      mode = pickIntricateMode({ ordinal });
    }
    const baseSeed = deriveSeed(args.seedOffset, variantId, mode);
    const paletteSeed = deriveSeed(baseSeed, "palette");
    const palette = generatePalette(paletteSeed);

    const { svg, bytes, detail } = buildVariant({ variantId, mode, palette, baseSeed });
    const fileName = `bgSpiral_${variantId}.svg`;
    const outPath = path.join(args.outDir, fileName);
    fs.writeFileSync(outPath, svg, "utf8");

    console.log(
      `${fileName} → ${outPath}\n  bytes=${bytes} | mode=${mode} | detail=${detail} | colors=${palette.hex.length} (${palette.hex.join(
        ", "
      )})`
    );

    if (bytes > TARGET_BYTES) {
      console.warn(`  warning: ${bytes} exceeds 20KB target (detail=${detail})`);
    }
  }
}

main();
