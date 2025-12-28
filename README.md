# philV1Background

**Fully on-chain, composable SVG background system for Phil v1 NFTs**

This repository contains the complete **background (bg) trait pipeline** for the Phil v1 NFT project.  
All background layers are generated, stored, and rendered **entirely on-chain**, with deterministic composition and versioned routing.

---

## Overview

A Phil v1 background is composed from **five independent SVG layers**:

1. **Color**
2. **Stars**
3. **Spiral**
4. **Nebula**
5. **Dust**

Each layer:
- Is generated off-chain as optimized SVG fragments
- Stored on-chain via **SSTORE2 atlases**
- Rendered by a dedicated **renderer contract**
- Composed on-chain into a final `<svg>` by a composer

The system is **modular, versioned, and future-proof**, allowing background upgrades without breaking existing tokens.

---

## Architecture
SVG Generator Scripts
↓
Fragment JSON
↓
Atlas Contracts (SSTORE2)
↓
Renderer Contracts
↓
BgComposerRenderer
↓
BgRegistryV2 (versioned)
↓
Final On-Chain SVG
---

## Contracts

### Atlases (SSTORE2 storage)
Each atlas stores minified SVG fragments:
- `BgColorAtlas`
- `BgStarsAtlas`
- `BgSpiralAtlas`
- `BgNebulaAtlas`
- `BgDustAtlas`

> Atlases are write-once and finalized after upload.

---

### Renderers
Each renderer:
- Points to its atlas
- Exposes `count()` and `render(id)`
- Returns **SVG fragments only** (no `<svg>` wrapper)

- `BgColorRenderer`
- `BgStarsRenderer`
- `BgSpiralRenderer`
- `BgNebulaRenderer`
- `BgDustRenderer`

---

### Composer
**`BgComposerRenderer`**
- Accepts the 5 renderer addresses
- Deterministically selects layer variants from a seed
- Concatenates fragments into a full SVG

```solidity
renderBg(uint256 seed) → string SVG
---

## Contracts

### Atlases (SSTORE2 storage)
Each atlas stores minified SVG fragments:
- `BgColorAtlas`
- `BgStarsAtlas`
- `BgSpiralAtlas`
- `BgNebulaAtlas`
- `BgDustAtlas`

> Atlases are write-once and finalized after upload.

---

### Renderers
Each renderer:
- Points to its atlas
- Exposes `count()` and `render(id)`
- Returns **SVG fragments only** (no `<svg>` wrapper)

- `BgColorRenderer`
- `BgStarsRenderer`
- `BgSpiralRenderer`
- `BgNebulaRenderer`
- `BgDustRenderer`

---

### Composer
**`BgComposerRenderer`**
- Accepts the 5 renderer addresses
- Deterministically selects layer variants from a seed
- Concatenates fragments into a full SVG

```solidity
renderBg(uint256 seed) → string SVG
Registry (Versioning)
	•	BgRegistryV2 → points to a single composer
	•	BgRegistry (Hub) → maps version → registry

This allows:
	•	Multiple background versions
	•	Safe upgrades
	•	Backwards compatibility
Local Development (from scratch)

1. Environment
nvm use 20
npm ci

Create .env:
SEPOLIA_RPC_URL=...
PRIVATE_KEY=...
ETHERSCAN_API_KEY=...

2. Generate SVGs
node scripts/bgColor/buildBgColorSvgAtlasMulti.js
node scripts/bgStars/buildBgStarsSvgAtlasMulti.js
node scripts/bgSpiral/buildBgSpiralSvgAtlasMulti.js
node scripts/bgNebula/buildBgNebulaSvgAtlasMulti.js
node scripts/bgDust/buildBgDustSvgAtlasMulti.js

3. Compile
npx hardhat clean
npx hardhat compile

4. Deploy (Localhost)
npx hardhat run scripts/deployBgAllAndComposer.cjs --network localhost
This will:
	•	Deploy all atlases
	•	Populate spiral atlas fragments
	•	Deploy renderers
	•	Deploy composer
	•	Deploy registry + hub
	•	Render a test SVG to /output/bg_composed_from_chain.svg

5. Deploy (Sepolia)
npx hardhat run scripts/deployBgAllAndComposer.cjs --network sepolia

Deployment addresses are saved to:
output/bg_deploy_report.json

Verifying Contracts (Sepolia)
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>

No constructor args are required for:
	•	Atlases
	•	Registry hub

Constructor args are required for:
	•	Renderers (atlas address)
	•	Composer (renderer addresses)
	•	RegistryV2 (composer address)

Reading on Etherscan

To view a composed background:
	1.	Open BgRegistryV2 on Etherscan
	2.	Go to Read Contract
	3.	Call:
renderBgSvgFromSeed(uint256 seed)
	4.	Copy the returned SVG string
	5.	Paste into a .svg file or browser

Output Artifacts
output/
├── bgSpiral_fragments.json
├── bg_composed_from_chain.svg
└── bg_deploy_report.json

