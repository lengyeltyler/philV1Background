// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBgSpiralAtlas {
    function getSpiralSvg(uint256 variantId) external view returns (bytes memory);
    function spiralCount() external view returns (uint256);
}

contract BgSpiralRenderer {
    IBgSpiralAtlas public immutable atlas;

    constructor(address _atlas) {
        require(_atlas != address(0), "atlas is zero");
        atlas = IBgSpiralAtlas(_atlas);

        // Fail-fast if atlas is wrong address / wrong contract
        atlas.spiralCount();
    }

    function render(uint256 variantId) external view returns (string memory) {
        return string(atlas.getSpiralSvg(variantId));
    }

    function count() external view returns (uint256) {
        return atlas.spiralCount();
    }
}