// public/traitGeneration/generateBgNebulaSvgs.js
import fs from "fs";
import path from "path";
import crypto from "crypto";

const WIDTH = 420;
const HEIGHT = 420;
const COUNT = 5;

function rand01() {
  const x = crypto.randomBytes(4).readUInt32BE(0);
  return x / 0x1_0000_0000;
}
function fmt1(n) {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
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

function generateNebulaPalette() {
  const baseHue = rand01() * 360;

  const c1 = hslToHex(baseHue, 70 + rand01() * 20, 55 + rand01() * 20);
  const c2 = hslToHex((baseHue + 25 + rand01() * 45) % 360, 55 + rand01() * 35, 45 + rand01() * 25);
  const c3 = hslToHex((baseHue + 160 + rand01() * 80) % 360, 40 + rand01() * 30, 55 + rand01() * 20);

  return { c1, c2, c3 };
}

function makeNebulaSvg(index) {
  const { c1, c2, c3 } = generateNebulaPalette();

  // Styles: radius + stop arrangement
  const styles = [
    { circleR: 92,  gradR: 165, stops: [
      ["0%",   c1, 1.0],
      ["35%",  c2, 0.65],
      ["70%",  c3, 0.25],
      ["100%", c3, 0.0],
    ]},
    { circleR: 110, gradR: 185, stops: [
      ["0%",   c2, 1.0],
      ["25%",  c1, 0.72],
      ["60%",  c3, 0.28],
      ["100%", c3, 0.0],
    ]},
    { circleR: 85,  gradR: 150, stops: [
      ["0%",   c1, 1.0],
      ["20%",  c1, 0.75],
      ["55%",  c2, 0.35],
      ["100%", c3, 0.0],
    ]},
    { circleR: 125, gradR: 205, stops: [
      ["0%",   c3, 0.95],
      ["30%",  c2, 0.55],
      ["65%",  c1, 0.25],
      ["100%", c1, 0.0],
    ]},
    { circleR: 100, gradR: 175, stops: [
      ["0%",   c2, 1.0],
      ["40%",  c3, 0.55],
      ["75%",  c1, 0.22],
      ["100%", c1, 0.0],
    ]},
  ];

  const st = styles[index % styles.length];

  // Drift center slightly
  const cx = 210 + (rand01() - 0.5) * 24;
  const cy = 210 + (rand01() - 0.5) * 24;

  const cxS = fmt1(cx);
  const cyS = fmt1(cy);

  const gradId = `neb${index}`;

  // KEY FIX: userSpaceOnUse + numeric r in same coordinate system
  let defs =
    `<defs><radialGradient id="${gradId}" gradientUnits="userSpaceOnUse" cx="${cxS}" cy="${cyS}" r="${st.gradR}">`;

  for (const [off, col, op] of st.stops) {
    defs += `<stop offset="${off}" stop-color="${col}" stop-opacity="${op}"/>`;
  }

  defs += `</radialGradient></defs>`;

  const circle = `<circle cx="${cxS}" cy="${cyS}" r="${st.circleR}" fill="url(#${gradId})"/>`;

  const g = `<g id="bgNebula">${defs}${circle}</g>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    g +
    `</svg>`;

  return { svg, colors: [c1, c2, c3], center: [cxS, cyS], circleR: st.circleR, gradR: st.gradR };
}

function main() {
  const outDir = path.join(process.cwd(), "output", "bgNebula");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < COUNT; i++) {
    const { svg, colors, center, circleR, gradR } = makeNebulaSvg(i);
    const fileName = `bgNebula_${i}.svg`;
    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, svg, "utf8");

    console.log(`Wrote ${fileName} → ${outPath}`);
    console.log(`  size: ${Buffer.byteLength(svg, "utf8")} bytes`);
    console.log(`  colors: ${colors.join(", ")}`);
    console.log(`  center: ${center.join(", ")} circleR=${circleR} gradR=${gradR}`);
  }
}

main();