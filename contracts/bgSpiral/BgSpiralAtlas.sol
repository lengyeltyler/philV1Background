
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SSTORE2 } from "solmate/src/utils/SSTORE2.sol";

/// @title BgSpiralAtlas
/// @notice Stores pre-minified bgSpiral SVG fragment variants using SSTORE2.
contract BgSpiralAtlas {
    address public owner;
    bool public finalized;
    address[] public spiralPointers;
    uint256 public constant EXPECTED_VARIANTS = 15;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function appendFragments(bytes[] calldata fragments) external onlyOwner {
        require(!finalized, "finalized");
        for (uint256 i = 0; i < fragments.length; i++) {
            spiralPointers.push(SSTORE2.write(fragments[i]));
        }
    }

    function finalizeUpload() external onlyOwner {
        require(!finalized, "finalized");
        require(spiralPointers.length == EXPECTED_VARIANTS, "incomplete");
        finalized = true;
    }

    function spiralCount() external view returns (uint256) {
        return spiralPointers.length;
    }

    /// @notice Returns the raw SVG fragment bytes for a spiral variant.
    function getSpiralSvg(uint256 variantId) external view returns (bytes memory) {
        require(variantId < spiralPointers.length, "Invalid spiral variant");
        return SSTORE2.read(spiralPointers[variantId]);
    }
}
