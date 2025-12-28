// scripts/deployAndRenderBgNebula.cjs
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Deploy atlas
  const BgNebulaAtlas = await hre.ethers.getContractFactory("BgNebulaAtlas");
  const atlas = await BgNebulaAtlas.deploy();
  const atlasReceipt = await atlas.deploymentTransaction().wait();
  console.log("BgNebulaAtlas deployed to:", await atlas.getAddress());
  console.log("  Atlas deploy gas used:", atlasReceipt.gasUsed.toString());

  // Deploy renderer
  const BgNebulaRenderer = await hre.ethers.getContractFactory("BgNebulaRenderer");
  const renderer = await BgNebulaRenderer.deploy(await atlas.getAddress());
  const rendererReceipt = await renderer.deploymentTransaction().wait();
  console.log("BgNebulaRenderer deployed to:", await renderer.getAddress());
  console.log("  Renderer deploy gas used:", rendererReceipt.gasUsed.toString());

  const count = await atlas.nebulaCount();
  console.log("bgNebula variants in atlas:", count.toString());

  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < Number(count); i++) {
    const fragment = await renderer.renderBgNebula(i);

    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">',
      fragment,
      "</svg>",
    ].join("");

    const outPath = path.join(outDir, `bgNebula_from_contract_${i}.svg`);
    fs.writeFileSync(outPath, svg);
    console.log(`Wrote bgNebula_from_contract_${i}.svg →`, outPath);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});