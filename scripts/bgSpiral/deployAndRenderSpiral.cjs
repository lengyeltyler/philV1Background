// scripts/deployAndRenderSpiral.cjs
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Deploy atlas
  const BgSpiralAtlas = await hre.ethers.getContractFactory("BgSpiralAtlas");
  const atlas = await BgSpiralAtlas.deploy();
  const atlasReceipt = await atlas.deploymentTransaction().wait();
  const atlasAddr = await atlas.getAddress();
  console.log("BgSpiralAtlas deployed to:", atlasAddr);
  console.log("  Atlas deploy gas used:", atlasReceipt.gasUsed.toString());

  const fragmentsPath = path.join(process.cwd(), "output", "spirals", "bgSpiral_fragments.json");
  if (!fs.existsSync(fragmentsPath)) {
    throw new Error(`Missing fragments JSON at ${fragmentsPath}. Run buildBgSpiralSvgAtlasMulti.js first.`);
  }
  const fragments = JSON.parse(fs.readFileSync(fragmentsPath, "utf8"));
  console.log("Uploading", fragments.length, "spiral fragments...");
  const chunkSize = 3;
  for (let i = 0; i < fragments.length; i += chunkSize) {
    const chunk = fragments.slice(i, i + chunkSize).map((frag) => "0x" + Buffer.from(frag, "utf8").toString("hex"));
    const tx = await atlas.appendFragments(chunk);
    await tx.wait();
    console.log(`  uploaded chunk ${i} - ${Math.min(fragments.length, i + chunkSize) - 1}`);
  }
  const finalizeTx = await atlas.finalizeUpload();
  await finalizeTx.wait();
  console.log("Atlas upload finalized.");

  // Deploy renderer
  const BgSpiralRenderer = await hre.ethers.getContractFactory("BgSpiralRenderer");
  const renderer = await BgSpiralRenderer.deploy(atlasAddr);
  const rendererReceipt = await renderer.deploymentTransaction().wait();
  const rendererAddr = await renderer.getAddress();
  console.log("BgSpiralRenderer deployed to:", rendererAddr);
  console.log("  Renderer deploy gas used:", rendererReceipt.gasUsed.toString());

  // Query count
  const count = await renderer.count();
  console.log("Spiral variants in atlas:", count.toString());

  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < Number(count); i++) {
    const fragment = await renderer.render(i);

    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">',
      fragment,
      "</svg>",
    ].join("");

    const outPath = path.join(outDir, `spiral_from_contract_${i}.svg`);
    fs.writeFileSync(outPath, svg);
    console.log(`Wrote spiral_from_contract_${i}.svg →`, outPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
