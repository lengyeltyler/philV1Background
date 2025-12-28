// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBgDustAtlas {
    function getDustSvg(uint256 variantId) external view returns (bytes memory);
    function dustCount() external view returns (uint256);
}

contract BgDustRenderer {
    IBgDustAtlas public immutable atlas;

    constructor(address _atlas) {
        require(_atlas != address(0), "atlas is zero");
        atlas = IBgDustAtlas(_atlas);
    }

    function render(uint256 variantId) external view returns (string memory) {
        return string(atlas.getDustSvg(variantId));
    }

    function count() external view returns (uint256) {
        return atlas.dustCount();
    }
}