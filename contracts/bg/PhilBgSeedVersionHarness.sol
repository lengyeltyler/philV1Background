// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

error BG_NO_REGISTRY(uint256 version);
error BG_ALREADY_MINTED(uint256 tokenId);

interface IBgRegistryHub {
    function bgRegistryByVersion(uint256 version) external view returns (address);
}

contract PhilBgSeedVersionHarness {
    // version -> registry (HUB mapping lives here in harness, like your earlier setup)
    mapping(uint256 => address) public bgRegistryByVersion;

    // tokenId -> seed/version
    mapping(uint256 => uint256) public bgSeedOf;
    mapping(uint256 => uint256) public bgVersionOf;

    event BgRegistrySet(uint256 indexed version, address indexed registry);
    event BgSeedMinted(uint256 indexed tokenId, uint256 indexed version, uint256 seed);

    function setBgRegistry(uint256 version, address reg) external {
        bgRegistryByVersion[version] = reg;
        emit BgRegistrySet(version, reg);
    }

    function bgRegistryOf(uint256 version) public view returns (address) {
        return bgRegistryByVersion[version];
    }

    /// @notice Mints/stores bgSeed + bgVersion for tokenId.
    /// IMPORTANT: does NOT call composer/registry/renderers (prevents silent 0x reverts).
    function mintBgSeed(uint256 tokenId, uint256 version) external {
        if (bgRegistryByVersion[version] == address(0)) revert BG_NO_REGISTRY(version);
        if (bgSeedOf[tokenId] != 0) revert BG_ALREADY_MINTED(tokenId);

        // deterministic-ish seed (fine for harness testing; you can swap later)
        uint256 seed = uint256(
            keccak256(
                abi.encodePacked(
                    tokenId,
                    version,
                    msg.sender,
                    block.chainid,
                    block.prevrandao,
                    block.timestamp
                )
            )
        );

        // ensure nonzero (optional, but avoids your “seed==0” branch)
        if (seed == 0) {
            seed = 1;
        }

        bgSeedOf[tokenId] = seed;
        bgVersionOf[tokenId] = version;

        emit BgSeedMinted(tokenId, version, seed);
    }

    /// @notice Helper to render through the per-version registry.
    /// This is the “read path” and can change per version without breaking mint.
    function renderBg(uint256 tokenId) external view returns (string memory) {
        uint256 seed = bgSeedOf[tokenId];
        uint256 ver = bgVersionOf[tokenId];
        address reg = bgRegistryByVersion[ver];
        if (reg == address(0)) revert BG_NO_REGISTRY(ver);

        // call the per-version registry (BgRegistryV2) which must implement:
        // function renderBgSvgFromSeed(uint256) external view returns (string memory)
        (bool ok, bytes memory data) = reg.staticcall(
            abi.encodeWithSignature("renderBgSvgFromSeed(uint256)", seed)
        );
        require(ok, "REGISTRY_RENDER_FAIL");
        return abi.decode(data, (string));
    }
}