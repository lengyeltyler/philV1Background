// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBgColorAtlas {
    function getBgColorSvg(uint256 variantId) external view returns (bytes memory);
    function colorCount() external view returns (uint256);
}

contract BgColorRenderer {
    IBgColorAtlas public immutable atlas;

    constructor(address _atlas) {
        require(_atlas != address(0), "atlas is zero");
        atlas = IBgColorAtlas(_atlas);
    }

    function render(uint256 variantId) external view returns (string memory) {
        return string(atlas.getBgColorSvg(variantId));
    }

    function count() external view returns (uint256) {
        return atlas.colorCount();
    }
}