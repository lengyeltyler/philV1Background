// scripts/deployBgAllAndComposer.cjs
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const https = require("https");

// ---------- price helper (best effort) ----------
function fetchEthUsd() {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const j = JSON.parse(data);
            const p = j?.ethereum?.usd;
            if (typeof p !== "number") throw new Error("bad price payload");
            resolve(p);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function toBigIntLike(x) {
  if (x == null) return 0n;
  if (typeof x === "bigint") return x;
  if (typeof x === "number") return BigInt(Math.trunc(x));
  if (typeof x === "string") return BigInt(x);
  if (typeof x.toString === "function") return BigInt(x.toString());
  throw new Error("Cannot convert to BigInt: " + String(x));
}

// IMPORTANT: name can be "ContractName" or "path:ContractName" (fully qualified)
async function deploy(name, args = []) {
  const F = await hre.ethers.getContractFactory(name);
  const c = await F.deploy(...args);
  const tx = c.deploymentTransaction();
  const receipt = await tx.wait();
  return { c, tx, receipt };
}

async function ensureSpiralAtlasPopulated(spiralAtlasContract, fragmentsPath) {
  const expected = Number(await spiralAtlasContract.EXPECTED_VARIANTS());
  const cur = Number(await spiralAtlasContract.spiralCount());

  if (cur === expected) {
    console.log(`✅ BgSpiralAtlas already populated (${cur}/${expected}).`);
    return;
  }

  if (cur !== 0) {
    throw new Error(
      `BgSpiralAtlas is partially populated (${cur}/${expected}). Refusing to continue.`
    );
  }

  if (!fs.existsSync(fragmentsPath)) {
    throw new Error(`Missing fragments JSON at: ${fragmentsPath}`);
  }

  const raw = fs.readFileSync(fragmentsPath, "utf8");
  const fragments = JSON.parse(raw);

  if (!Array.isArray(fragments) || fragments.length !== expected) {
    throw new Error(
      `Fragments JSON must be an array of length ${expected}. Got: ${
        Array.isArray(fragments) ? fragments.length : typeof fragments
      }`
    );
  }

  console.log(
    `🧩 Populating BgSpiralAtlas with ${fragments.length} fragments from ${fragmentsPath}`
  );

  // send as bytes[] (utf8 bytes)
  const bytesArr = fragments.map((s) => hre.ethers.toUtf8Bytes(s));

  // batch append to avoid huge calldata
  const batchSize = 3;
  for (let i = 0; i < bytesArr.length; i += batchSize) {
    const batch = bytesArr.slice(i, i + batchSize);
    const tx = await spiralAtlasContract.appendFragments(batch);
    await tx.wait();
    console.log(`  - appended fragments [${i}..${i + batch.length - 1}]`);
  }

  // IMPORTANT: the function is finalizeUpload(), NOT finalize()
  const finTx = await spiralAtlasContract.finalizeUpload();
  await finTx.wait();
  console.log("  - finalizeUpload() ✅");

  const after = Number(await spiralAtlasContract.spiralCount());
  if (after !== expected) {
    throw new Error(`Spiral count mismatch after upload: ${after}/${expected}`);
  }

  console.log(`✅ BgSpiralAtlas populated (${after}/${expected}).`);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Network:", hre.network.name);
  console.log("Deploying with:", deployer.address);

  // live price best-effort
  let ethUsd = null;
  try {
    ethUsd = await fetchEthUsd();
  } catch (e) {
    console.log("WARN: could not fetch ETH/USD price (continuing).", e.message);
  }

  const report = {
    network: hre.network.name,
    deployer: deployer.address,
    ethUsd,
    contracts: {},
    totals: {},
  };

  function record(label, address, receipt, tx) {
    const gasUsed = toBigIntLike(receipt.gasUsed);
    const gasPrice = toBigIntLike(receipt.effectiveGasPrice ?? tx.gasPrice ?? 0n);
    const weiSpent = gasUsed * gasPrice;

    const ethSpentStr = hre.ethers.formatEther(weiSpent);
    const ethSpentNum = Number(ethSpentStr);

    const entry = {
      address,
      txHash: receipt.hash,
      gasUsed: gasUsed.toString(),
      effectiveGasPriceWei: gasPrice.toString(),
      weiSpent: weiSpent.toString(),
      ethSpent: ethSpentStr,
    };

    if (ethUsd != null) entry.usdSpent = ethSpentNum * ethUsd;
    report.contracts[label] = entry;

    console.log(`${label}: ${address} gas: ${entry.gasUsed}`);
    if (ethUsd != null) {
      console.log(
        `  cost: ~${ethSpentNum.toFixed(6)} ETH (~$${entry.usdSpent.toFixed(2)})`
      );
    } else {
      console.log(`  cost: ~${ethSpentNum.toFixed(6)} ETH`);
    }
  }

  // where the spiral fragments live
  const spiralFragmentsPath = path.join(
    process.cwd(),
    "output",
    "bgSpiral",
    "bgSpiral_fragments.json"
  );

  // ---- Deploy Atlases (fully qualified to avoid collisions) ----
  const d1 = await deploy("contracts/bgColor/BgColorAtlas.sol:BgColorAtlas");
  record("BgColorAtlas", await d1.c.getAddress(), d1.receipt, d1.tx);

  const d2 = await deploy("contracts/bgStars/BgStarsAtlas.sol:BgStarsAtlas");
  record("BgStarsAtlas", await d2.c.getAddress(), d2.receipt, d2.tx);

  const d3 = await deploy("contracts/bgSpiral/BgSpiralAtlas.sol:BgSpiralAtlas");
  record("BgSpiralAtlas", await d3.c.getAddress(), d3.receipt, d3.tx);

  const d4 = await deploy("contracts/bgNebula/BgNebulaAtlas.sol:BgNebulaAtlas");
  record("BgNebulaAtlas", await d4.c.getAddress(), d4.receipt, d4.tx);

  const d5 = await deploy("contracts/bgDust/BgDustAtlas.sol:BgDustAtlas");
  record("BgDustAtlas", await d5.c.getAddress(), d5.receipt, d5.tx);

  // ---- Populate Spiral Atlas (because this atlas is uploaded post-deploy) ----
  await ensureSpiralAtlasPopulated(d3.c, spiralFragmentsPath);

  // ---- Deploy Renderers (each takes atlas address) ----
  const r1 = await deploy(
    "contracts/bgColor/BgColorRenderer.sol:BgColorRenderer",
    [await d1.c.getAddress()]
  );
  record("BgColorRenderer", await r1.c.getAddress(), r1.receipt, r1.tx);

  const r2 = await deploy(
    "contracts/bgStars/BgStarsRenderer.sol:BgStarsRenderer",
    [await d2.c.getAddress()]
  );
  record("BgStarsRenderer", await r2.c.getAddress(), r2.receipt, r2.tx);

  const r3 = await deploy(
    "contracts/bgSpiral/BgSpiralRenderer.sol:BgSpiralRenderer",
    [await d3.c.getAddress()]
  );
  record("BgSpiralRenderer", await r3.c.getAddress(), r3.receipt, r3.tx);

  const r4 = await deploy(
    "contracts/bgNebula/BgNebulaRenderer.sol:BgNebulaRenderer",
    [await d4.c.getAddress()]
  );
  record("BgNebulaRenderer", await r4.c.getAddress(), r4.receipt, r4.tx);

  const r5 = await deploy(
    "contracts/bgDust/BgDustRenderer.sol:BgDustRenderer",
    [await d5.c.getAddress()]
  );
  record("BgDustRenderer", await r5.c.getAddress(), r5.receipt, r5.tx);

  // ---- Deploy Composer (expects renderer addresses, NOT atlases) ----
  const comp = await deploy(
    "contracts/BgComposerRenderer.sol:BgComposerRenderer",
    [
      await r1.c.getAddress(),
      await r2.c.getAddress(),
      await r3.c.getAddress(),
      await r4.c.getAddress(),
      await r5.c.getAddress(),
    ]
  );
  record("BgComposerRenderer", await comp.c.getAddress(), comp.receipt, comp.tx);

  // ---- Deploy RegistryV2 (points to composer) ----
  const regV2 = await deploy("contracts/bg/BgRegistryV2.sol:BgRegistryV2", [
    await comp.c.getAddress(),
  ]);
  record("BgRegistryV2", await regV2.c.getAddress(), regV2.receipt, regV2.tx);

  // ---- Deploy Hub (optional, but you’re already using it) ----
  const hub = await deploy("contracts/bg/BgRegistry.sol:BgRegistry", []);
  record("BgRegistryHub", await hub.c.getAddress(), hub.receipt, hub.tx);

  // Set mapping version -> regV2
  await (await hub.c.setBgRegistry(1, await regV2.c.getAddress())).wait();
  console.log("BgRegistryHub.setBgRegistry(1, BgRegistryV2) ✅");

  // ---- Counts sanity (use renderer.count()) ----
  const counts = {
    colors: Number(await r1.c.count()),
    stars: Number(await r2.c.count()),
    spiral: Number(await r3.c.count()),
    nebula: Number(await r4.c.count()),
    dust: Number(await r5.c.count()),
  };
  console.log("Counts:", counts);

  // Hard fail before rendering so you don’t get BG_BAD_COUNTS without context
  for (const [k, v] of Object.entries(counts)) {
    if (v <= 0)
      throw new Error(
        `COUNT_IS_ZERO: ${k} is ${v}. That layer’s atlas/render data is not wired correctly.`
      );
  }

  // ---- Render one composed SVG ----
  const seed = 12345;
  const svg = await regV2.c.renderBgSvgFromSeed(seed);

  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const svgPath = path.join(outDir, "bg_composed_from_chain.svg");
  fs.writeFileSync(svgPath, svg, "utf8");
  console.log("Wrote bg_composed_from_chain.svg →", svgPath);

  // ---- Report ----
  const reportPath = path.join(outDir, "bg_deploy_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log("Wrote bg_deploy_report.json →", reportPath);

  console.log("\nDONE ✅");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});