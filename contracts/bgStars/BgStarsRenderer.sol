// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBgStarsAtlas {
    function getStarsSvg(uint256 variantId) external view returns (bytes memory);
    function starsCount() external view returns (uint256);
}

contract BgStarsRenderer {
    IBgStarsAtlas public immutable atlas;

    constructor(address _atlas) {
        require(_atlas != address(0), "atlas is zero");
        atlas = IBgStarsAtlas(_atlas);
    }

    function render(uint256 variantId) external view returns (string memory) {
        return string(atlas.getStarsSvg(variantId));
    }

    function count() external view returns (uint256) {
        return atlas.starsCount();
    }
}