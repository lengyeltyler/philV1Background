// scripts/buildBgSpiralSvgAtlasMulti.js
import fs from "fs";
import path from "path";
import { optimize } from "svgo";

function parseArgs() {
  const defaults = {
    inDir: path.join(process.cwd(), "output", "bgSpiral"),
  };
  const args = { ...defaults };
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg.startsWith("--")) continue;
    let key = arg.slice(2);
    let value;
    if (key.includes("=")) {
      const pieces = key.split("=");
      key = pieces[0];
      value = pieces[1];
    } else {
      value = process.argv[i + 1];
      i++;
    }
    if (key === "inDir" && value) {
      args.inDir = path.isAbsolute(value) ? value : path.join(process.cwd(), value);
    }
  }
  return args;
}

const { inDir } = parseArgs();

const outContractsDir = path.join(process.cwd(), "contracts", "bgSpiral");
const outContractPath = path.join(outContractsDir, "BgSpiralAtlas.sol");
const outFragmentsPath = path.join(inDir, "bgSpiral_fragments.json");

if (!fs.existsSync(outContractsDir)) fs.mkdirSync(outContractsDir, { recursive: true });

function extractInnerSvg(svgText) {
  const m = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  if (!m) throw new Error("Could not find <svg>...</svg> wrapper");
  return m[1].trim();
}

function ensureHasBgSpiralGroup(fragment, fileName) {
  if (!/id=["']bgSpiral["']/.test(fragment)) {
    throw new Error(
      `Missing id="bgSpiral" group in ${fileName}. ` +
      `Make sure the saved SVG contains <g id="bgSpiral">...</g>.`
    );
  }
}

function minifyFragment(fragment) {
  // Wrap so SVGO can parse reliably
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
            cleanupIds: false, // keep bgSpiral id
          },
        },
      },
      { name: "removeViewBox", active: false },
    ],
  });

  if (result.error) throw new Error(`SVGO error: ${result.error}`);
  return extractInnerSvg(result.data);
}

function contractTemplate(expectedCount) {
  return `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SSTORE2 } from "solmate/src/utils/SSTORE2.sol";

/// @title BgSpiralAtlas
/// @notice Stores pre-minified bgSpiral SVG fragment variants using SSTORE2.
contract BgSpiralAtlas {
    address public owner;
    bool public finalized;
    address[] public spiralPointers;
    uint256 public constant EXPECTED_VARIANTS = ${expectedCount};

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function appendFragments(bytes[] calldata fragments) external onlyOwner {
        require(!finalized, "finalized");
        for (uint256 i = 0; i < fragments.length; i++) {
            spiralPointers.push(SSTORE2.write(fragments[i]));
        }
    }

    function finalizeUpload() external onlyOwner {
        require(!finalized, "finalized");
        require(spiralPointers.length == EXPECTED_VARIANTS, "incomplete");
        finalized = true;
    }

    function spiralCount() external view returns (uint256) {
        return spiralPointers.length;
    }

    /// @notice Returns the raw SVG fragment bytes for a spiral variant.
    function getSpiralSvg(uint256 variantId) external view returns (bytes memory) {
        require(variantId < spiralPointers.length, "Invalid spiral variant");
        return SSTORE2.read(spiralPointers[variantId]);
    }
}
`;
}

function main() {
  console.log("Building multi-variant BgSpiralAtlas from:", inDir);

  if (!fs.existsSync(inDir)) {
    throw new Error(`Input directory not found: ${inDir}`);
  }

  const files = fs
    .readdirSync(inDir)
    .filter((name) => /^bgSpiral_(\d+)\.svg$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/(\d+)\.svg$/)[1]);
      const nb = Number(b.match(/(\d+)\.svg$/)[1]);
      return na - nb;
    });

  if (!files.length) {
    throw new Error(`No bgSpiral_<id>.svg files found inside ${inDir}`);
  }

  const fragments = [];

  for (const fileName of files) {
    const p = path.join(inDir, fileName);
    const rawSvg = fs.readFileSync(p, "utf8");
    const rawInner = extractInnerSvg(rawSvg);
    ensureHasBgSpiralGroup(rawInner, fileName);

    const minInner = minifyFragment(rawInner);
    ensureHasBgSpiralGroup(minInner, fileName);

    const rawBytes = Buffer.byteLength(rawInner, "utf8");
    const minBytes = Buffer.byteLength(minInner, "utf8");

    console.log(`- ${fileName}`);
    console.log(`    inner bytes: ${rawBytes}`);
    console.log(`    min bytes:   ${minBytes}`);

    fragments.push({ fileName, minInner });
  }

  const minFragments = fragments.map((f) => f.minInner);
  fs.writeFileSync(outFragmentsPath, JSON.stringify(minFragments, null, 2), "utf8");
  console.log("Wrote bgSpiral_fragments.json →", outFragmentsPath);

  const contractSource = contractTemplate(fragments.length);
  fs.writeFileSync(outContractPath, contractSource, "utf8");
  console.log("Wrote BgSpiralAtlas.sol →", outContractPath);
  console.log("Variant order:");
  files.forEach((f, i) => console.log(`  ${i}: ${f}`));
}

main();
