// scripts/buildBgColorSvgAtlasMulti.js
import fs from "fs";
import path from "path";
import { optimize } from "svgo";

const inDir = path.join(process.cwd(), "output", "bgColor");
const files = [
  "bgColor_0.svg",
  "bgColor_1.svg",
  "bgColor_2.svg",
  "bgColor_3.svg",
  "bgColor_4.svg",
];

const outContractsDir = path.join(process.cwd(), "contracts");
const outContractPath = path.join(outContractsDir, "BgColorAtlas.sol");

if (!fs.existsSync(outContractsDir)) fs.mkdirSync(outContractsDir, { recursive: true });

function extractInnerSvg(svgText) {
  const m = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  if (!m) throw new Error("Could not find <svg>...</svg> wrapper");
  return m[1].trim();
}

function minifyFragment(fragment) {
  const wrapped =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420">` +
    fragment +
    `</svg>`;

  const result = optimize(wrapped, {
    multipass: true,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            cleanupIds: false, // keep bgColor id
          },
        },
      },
      { name: "removeViewBox", active: false },
    ],
  });

  if (result.error) throw new Error(`SVGO error: ${result.error}`);
  return extractInnerSvg(result.data);
}

function solidityHeader() {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SSTORE2 } from "solmate/src/utils/SSTORE2.sol";

/// @title BgColorAtlas
/// @notice Stores bgColor SVG fragments using SSTORE2 (multiple variants).
contract BgColorAtlas {
    address[] public colorPointers;

    constructor() {
`;
}

function solidityFooter() {
  return `
    }

    function colorCount() external view returns (uint256) {
        return colorPointers.length;
    }

    function getBgColorSvg(uint256 variantId) external view returns (bytes memory) {
        require(variantId < colorPointers.length, "Invalid bgColor variant");
        return SSTORE2.read(colorPointers[variantId]);
    }
}
`;
}

function main() {
  console.log("Building BgColorAtlas from:", inDir);

  const frags = [];

  for (const fileName of files) {
    const p = path.join(inDir, fileName);
    if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);

    const raw = fs.readFileSync(p, "utf8");
    const inner = extractInnerSvg(raw);

    const minInner = minifyFragment(inner);

    console.log(`- ${fileName}`);
    console.log(`    inner bytes: ${Buffer.byteLength(inner, "utf8")}`);
    console.log(`    min bytes:   ${Buffer.byteLength(minInner, "utf8")}`);

    frags.push({ fileName, minInner });
  }

  let out = solidityHeader();

  frags.forEach((f, i) => {
    const hexData = Buffer.from(f.minInner, "utf8").toString("hex");
    out += `        // variant ${i}: ${f.fileName}\n`;
    out += `        colorPointers.push(SSTORE2.write(hex"${hexData}"));\n`;
  });

  out += solidityFooter();
  fs.writeFileSync(outContractPath, out, "utf8");

  console.log("Wrote BgColorAtlas.sol →", outContractPath);
  console.log("Variant order:");
  files.forEach((f, i) => console.log(`  ${i}: ${f}`));
}

main();