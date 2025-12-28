// public/traitGeneration/generateBgColorSvgs.js
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

function generateNiceBgColor() {
  // Bias toward darker-but-colorful backgrounds that make stars/nebula pop
  const h = rand01() * 360;
  const s = 55 + rand01() * 35;   // 55–90
  const l = 10 + rand01() * 18;   // 10–28 (dark)
  return hslToHex(h, s, l);
}

function makeSvg(colorHex) {
  // Keep it in a group so we can store just the fragment if we want later
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<g id="bgColor">` +
    `<rect width="100%" height="100%" fill="${colorHex}"/>` +
    `</g>` +
    `</svg>`
  );
}

function main() {
  const outDir = path.join(process.cwd(), "output", "bgColor");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const colors = [];

  for (let i = 0; i < COUNT; i++) {
    const color = generateNiceBgColor();
    colors.push(color);

    const svg = makeSvg(color);
    const fileName = `bgColor_${i}.svg`;
    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, svg, "utf8");

    console.log(`Wrote ${fileName} → ${outPath} (${Buffer.byteLength(svg, "utf8")} bytes) color=${color}`);
  }

  console.log("Done. Colors:", colors);
}

main();