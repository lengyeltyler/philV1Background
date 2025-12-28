// scripts/buildBgDustSvgAtlasMulti.js
import fs from "fs";
import path from "path";
import { optimize } from "svgo";

const inDir = path.join(process.cwd(), "output", "bgDust");

// Order = variantId
const files = [
  "bgDust_0.svg",
  "bgDust_1.svg",
  "bgDust_2.svg",
  "bgDust_3.svg",
  "bgDust_4.svg",
];

const outContractsDir = path.join(process.cwd(), "contracts");
const outContractPath = path.join(outContractsDir, "BgDustAtlas.sol");

if (!fs.existsSync(outContractsDir)) fs.mkdirSync(outContractsDir, { recursive: true });

function extractInnerSvg(svgText) {
  const m = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  if (!m) throw new Error("Could not find <svg>...</svg> wrapper");
  return m[1].trim();
}

function ensureHasDustGroup(fragment, fileName) {
  if (!/id=["']bgDust["']/.test(fragment)) {
    throw new Error(
      `Missing id="bgDust" group in ${fileName}. Make sure it contains <g id="bgDust">...</g>.`
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
            cleanupIds: false, // keep bgDust id
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

/// @title BgDustAtlas
/// @notice Stores pre-minified bgDust SVG fragment variants using SSTORE2.
contract BgDustAtlas {
    address[] public dustPointers;

    constructor() {
`;
}

function solidityFooter() {
  return `
    }

    function dustCount() external view returns (uint256) {
        return dustPointers.length;
    }

    function getDustSvg(uint256 variantId) external view returns (bytes memory) {
        require(variantId < dustPointers.length, "Invalid bgDust variant");
        return SSTORE2.read(dustPointers[variantId]);
    }
}
`;
}

function main() {
  console.log("Building BgDustAtlas from:", inDir);

  const fragments = [];

  for (const fileName of files) {
    const p = path.join(inDir, fileName);
    if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);

    const rawSvg = fs.readFileSync(p, "utf8");
    const rawInner = extractInnerSvg(rawSvg);
    ensureHasDustGroup(rawInner, fileName);

    const minInner = minifyFragment(rawInner);
    ensureHasDustGroup(minInner, fileName);

    console.log(`- ${fileName}`);
    console.log(`    inner bytes: ${Buffer.byteLength(rawInner, "utf8")}`);
    console.log(`    min bytes:   ${Buffer.byteLength(minInner, "utf8")}`);

    fragments.push({ fileName, minInner });
  }

  let out = solidityHeader();

  fragments.forEach((f, i) => {
    const hexData = Buffer.from(f.minInner, "utf8").toString("hex");
    out += `        // variant ${i}: ${f.fileName}\n`;
    out += `        dustPointers.push(SSTORE2.write(hex"${hexData}"));\n`;
  });

  out += solidityFooter();

  fs.writeFileSync(outContractPath, out, "utf8");
  console.log("Wrote BgDustAtlas.sol →", outContractPath);
  console.log("Variant order:");
  files.forEach((f, i) => console.log(`  ${i}: ${f}`));
}

main();