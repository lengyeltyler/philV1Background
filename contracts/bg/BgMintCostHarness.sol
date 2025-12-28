// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBgRegistry {
    function bgSeed(uint256 tokenId, address minter, bytes32 salt) external pure returns (uint256);
    function pickBgVariants(uint256 tokenId, address minter, bytes32 salt)
        external
        view
        returns (uint256 c, uint256 s, uint256 sp, uint256 n, uint256 d);
}

contract BgMintCostHarness {
    IBgRegistry public immutable reg;
    bytes32 public immutable salt;

    // packed: [c|s|sp|n|d] each uint8 (5 bytes total)
    mapping(uint256 => uint40) public bgPacked;

    event MintedBg(uint256 indexed tokenId, uint40 packed);

    constructor(address registry, bytes32 _salt) {
        reg = IBgRegistry(registry);
        salt = _salt;
    }

    function mintBg(uint256 tokenId) external {
        (uint256 c, uint256 s, uint256 sp, uint256 n, uint256 d) =
            reg.pickBgVariants(tokenId, msg.sender, salt);

        require(c < 256 && s < 256 && sp < 256 && n < 256 && d < 256, "IDX_OOB");

        uint40 packed =
            uint40(c) |
            (uint40(s) << 8) |
            (uint40(sp) << 16) |
            (uint40(n) << 24) |
            (uint40(d) << 32);

        bgPacked[tokenId] = packed;
        emit MintedBg(tokenId, packed);
    }
}