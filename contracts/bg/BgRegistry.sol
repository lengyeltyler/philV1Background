// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

error BG_NO_REGISTRY(uint256 version);

/// @title BgRegistry (Hub)
/// @notice Stores bgVersion => BgRegistryV2 address mappings (version routing).
contract BgRegistry {
    mapping(uint256 => address) public bgRegistryByVersion;

    function setBgRegistry(uint256 version, address reg) external {
        bgRegistryByVersion[version] = reg;
    }

    function getRegistry(uint256 version) public view returns (address) {
        address reg = bgRegistryByVersion[version];
        if (reg == address(0)) revert BG_NO_REGISTRY(version);
        return reg;
    }
}