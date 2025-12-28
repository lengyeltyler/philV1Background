// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SSTORE2 } from "solmate/src/utils/SSTORE2.sol";

/// @title BgColorAtlas
/// @notice Stores bgColor SVG fragments using SSTORE2 (multiple variants).
contract BgColorAtlas {
    address[] public colorPointers;

    constructor() {
        // variant 0: bgColor_0.svg
        colorPointers.push(SSTORE2.write(hex"3c726563742069643d226267436f6c6f72222077696474683d223130302522206865696768743d2231303025222066696c6c3d2223313335653737222f3e"));
        // variant 1: bgColor_1.svg
        colorPointers.push(SSTORE2.write(hex"3c726563742069643d226267436f6c6f72222077696474683d223130302522206865696768743d2231303025222066696c6c3d2223376330623366222f3e"));
        // variant 2: bgColor_2.svg
        colorPointers.push(SSTORE2.write(hex"3c726563742069643d226267436f6c6f72222077696474683d223130302522206865696768743d2231303025222066696c6c3d2223303433323139222f3e"));
        // variant 3: bgColor_3.svg
        colorPointers.push(SSTORE2.write(hex"3c726563742069643d226267436f6c6f72222077696474683d223130302522206865696768743d2231303025222066696c6c3d2223316436383236222f3e"));
        // variant 4: bgColor_4.svg
        colorPointers.push(SSTORE2.write(hex"3c726563742069643d226267436f6c6f72222077696474683d223130302522206865696768743d2231303025222066696c6c3d2223343531373534222f3e"));

    }

    function colorCount() external view returns (uint256) {
        return colorPointers.length;
    }

    function getBgColorSvg(uint256 variantId) external view returns (bytes memory) {
        require(variantId < colorPointers.length, "Invalid bgColor variant");
        return SSTORE2.read(colorPointers[variantId]);
    }
}
