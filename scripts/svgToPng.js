// scripts/svgToPng.js
// Converts every SVG under ./output (or a provided directory) into PNGs using sharp.
import fs from "fs";
import path from "path";
import sharp from "sharp";

const DEFAULT_IN = path.join(process.cwd(), "output");
const DEFAULT_OUT = path.join(DEFAULT_IN, "png");

const inDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_IN;
const outDir = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUT;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function listSvgFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSvgFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".svg")) {
      files.push(full);
    }
  }

  return files;
}

async function convertSvg(svgPath) {
  const rel = path.relative(inDir, svgPath);
  const outPath = path.join(outDir, rel).replace(/\.svg$/i, ".png");
  ensureDir(path.dirname(outPath));

  const svgBuffer = fs.readFileSync(svgPath);
  // Use a higher density so the rasterized PNGs look crisp if scaled.
  const pngBuffer = await sharp(svgBuffer, { density: 300 }).png({ compressionLevel: 9 }).toBuffer();

  fs.writeFileSync(outPath, pngBuffer);
  console.log(`Converted ${rel} → ${path.relative(process.cwd(), outPath)}`);
}

async function main() {
  if (!fs.existsSync(inDir)) {
    console.error(`Input directory does not exist: ${inDir}`);
    process.exit(1);
  }

  ensureDir(outDir);

  const svgFiles = listSvgFiles(inDir);
  if (svgFiles.length === 0) {
    console.log(`No SVG files found under ${inDir}`);
    return;
  }

  for (const file of svgFiles) {
    await convertSvg(file);
  }

  console.log(`Done. PNGs are under ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
