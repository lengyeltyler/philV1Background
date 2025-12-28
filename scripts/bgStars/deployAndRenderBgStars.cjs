// scripts/deployAndRenderBgStars.cjs
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Deploy atlas
  const BgStarsAtlas = await hre.ethers.getContractFactory("BgStarsAtlas");
  const atlas = await BgStarsAtlas.deploy();
  const atlasReceipt = await atlas.deploymentTransaction().wait();
  console.log("BgStarsAtlas deployed to:", await atlas.getAddress());
  console.log("  Atlas deploy gas used:", atlasReceipt.gasUsed.toString());

  // Deploy renderer
  const BgStarsRenderer = await hre.ethers.getContractFactory("BgStarsRenderer");
  const renderer = await BgStarsRenderer.deploy(await atlas.getAddress());
  const rendererReceipt = await renderer.deploymentTransaction().wait();
  console.log("BgStarsRenderer deployed to:", await renderer.getAddress());
  console.log("  Renderer deploy gas used:", rendererReceipt.gasUsed.toString());

  const count = await atlas.starsCount();
  console.log("bgStars variants in atlas:", count.toString());

  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < Number(count); i++) {
    const fragment = await renderer.renderBgStars(i);

    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">',
      fragment,
      "</svg>",
    ].join("");

    const outPath = path.join(outDir, `bgStars_from_contract_${i}.svg`);
    fs.writeFileSync(outPath, svg);
    console.log(`Wrote bgStars_from_contract_${i}.svg →`, outPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});