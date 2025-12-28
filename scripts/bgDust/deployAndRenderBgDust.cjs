// scripts/deployAndRenderBgDust.cjs
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Deploy atlas
  const BgDustAtlas = await hre.ethers.getContractFactory("BgDustAtlas");
  const atlas = await BgDustAtlas.deploy();
  const atlasReceipt = await atlas.deploymentTransaction().wait();
  console.log("BgDustAtlas deployed to:", await atlas.getAddress());
  console.log("  Atlas deploy gas used:", atlasReceipt.gasUsed.toString());

  // Deploy renderer
  const BgDustRenderer = await hre.ethers.getContractFactory("BgDustRenderer");
  const renderer = await BgDustRenderer.deploy(await atlas.getAddress());
  const rendererReceipt = await renderer.deploymentTransaction().wait();
  console.log("BgDustRenderer deployed to:", await renderer.getAddress());
  console.log("  Renderer deploy gas used:", rendererReceipt.gasUsed.toString());

  const count = await atlas.dustCount();
  console.log("bgDust variants in atlas:", count.toString());

  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < Number(count); i++) {
    const fragment = await renderer.renderBgDust(i);

    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">',
      fragment,
      "</svg>",
    ].join("");

    const outPath = path.join(outDir, `bgDust_from_contract_${i}.svg`);
    fs.writeFileSync(outPath, svg);
    console.log(`Wrote bgDust_from_contract_${i}.svg →`, outPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});