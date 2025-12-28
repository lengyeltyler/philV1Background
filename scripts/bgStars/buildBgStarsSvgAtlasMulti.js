// scripts/buildBgStarsSvgAtlasMulti.js
import fs from "fs";
import path from "path";
import { optimize } from "svgo";

const inDir = path.join(process.cwd(), "output", "bgStars");

// Your generated files (order = variantId)
const files = [
  "bgStars_0.svg",
  "bgStars_1.svg",
  "bgStars_2.svg",
  "bgStars_3.svg",
  "bgStars_4.svg",
];

const outContractsDir = path.join(process.cwd(), "contracts");
const outContractPath = path.join(outContractsDir, "BgStarsAtlas.sol");

if (!fs.existsSync(outContractsDir)) fs.mkdirSync(outContractsDir, { recursive: true });

function extractInnerSvg(svgText) {
  const m = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  if (!m) throw new Error("Could not find <svg>...</svg> wrapper");
  return m[1].trim();
}

function ensureHasBgStarsGroup(fragment, fileName) {
  if (!/id=["']bgStars["']/.test(fragment)) {
    throw new Error(
      `Missing id="bgStars" group in ${fileName}. Make sure it contains <g id="bgStars">...</g>.`
    );
  }
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
            cleanupIds: false, // keep bgStars id
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

/// @title BgStarsAtlas
/// @notice Stores pre-minified bgStars SVG fragment variants using SSTORE2.
contract BgStarsAtlas {
    address[] public starsPointers;

    constructor() {
`;
}

function solidityFooter() {
  return `
    }

    function starsCount() external view returns (uint256) {
        return starsPointers.length;
    }

    /// @notice Returns the raw SVG fragment bytes for a stars variant.
    function getStarsSvg(uint256 variantId) external view returns (bytes memory) {
        require(variantId < starsPointers.length, "Invalid bgStars variant");
        return SSTORE2.read(starsPointers[variantId]);
    }
}
`;
}

function main() {
  console.log("Building BgStarsAtlas from:", inDir);

  const fragments = [];

  for (const fileName of files) {
    const p = path.join(inDir, fileName);
    if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);

    const rawSvg = fs.readFileSync(p, "utf8");
    const rawInner = extractInnerSvg(rawSvg);
    ensureHasBgStarsGroup(rawInner, fileName);

    const minInner = minifyFragment(rawInner);
    ensureHasBgStarsGroup(minInner, fileName);

    console.log(`- ${fileName}`);
    console.log(`    inner bytes: ${Buffer.byteLength(rawInner, "utf8")}`);
    console.log(`    min bytes:   ${Buffer.byteLength(minInner, "utf8")}`);

    fragments.push({ fileName, minInner });
  }

  let out = solidityHeader();

  fragments.forEach((f, i) => {
    const hexData = Buffer.from(f.minInner, "utf8").toString("hex");
    out += `        // variant ${i}: ${f.fileName}\n`;
    out += `        starsPointers.push(SSTORE2.write(hex"${hexData}"));\n`;
  });

  out += solidityFooter();

  fs.writeFileSync(outContractPath, out, "utf8");
  console.log("Wrote BgStarsAtlas.sol →", outContractPath);
  console.log("Variant order:");
  files.forEach((f, i) => console.log(`  ${i}: ${f}`));
}

main();