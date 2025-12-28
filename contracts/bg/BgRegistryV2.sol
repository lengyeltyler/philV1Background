// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBgComposer {
    function renderBg(uint256 seed) external view returns (string memory);
}

error BG_BAD_COMPOSER();

/// @title BgRegistryV2
/// @notice Versioned registry instance that points to a composer for rendering.
contract BgRegistryV2 {
    IBgComposer public immutable composer;

    constructor(address _composer) {
        if (_composer == address(0)) revert BG_BAD_COMPOSER();
        composer = IBgComposer(_composer);
    }

    function renderBgSvgFromSeed(uint256 seed) external view returns (string memory) {
        return composer.renderBg(seed);
    }
}