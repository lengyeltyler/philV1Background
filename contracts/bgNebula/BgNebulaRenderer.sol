// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBgNebulaAtlas {
    function getNebulaSvg(uint256 variantId) external view returns (bytes memory);
    function nebulaCount() external view returns (uint256);
}

contract BgNebulaRenderer {
    IBgNebulaAtlas public immutable atlas;

    constructor(address _atlas) {
        require(_atlas != address(0), "atlas is zero");
        atlas = IBgNebulaAtlas(_atlas);
    }

    function render(uint256 variantId) external view returns (string memory) {
        return string(atlas.getNebulaSvg(variantId));
    }

    function count() external view returns (uint256) {
        return atlas.nebulaCount();
    }
}