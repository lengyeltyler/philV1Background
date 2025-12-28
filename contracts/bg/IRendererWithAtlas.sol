// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRendererWithAtlas {
    function atlas() external view returns (address);
    function render(uint256 id) external view returns (string memory);
}