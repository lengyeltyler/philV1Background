// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBgLayerRenderer {
    function atlas() external view returns (address);
    function render(uint256 id) external view returns (string memory);
    function count() external view returns (uint256);
}

error BG_LAYER_FAIL(uint8 layer, bytes data); // 0=color 1=stars 2=spiral 3=nebula 4=dust
error BG_BAD_RENDERER(uint8 layer);
error BG_BAD_COUNTS();

contract BgComposerRenderer {
    IBgLayerRenderer public immutable colorR;
    IBgLayerRenderer public immutable starsR;
    IBgLayerRenderer public immutable spiralR;
    IBgLayerRenderer public immutable nebulaR;
    IBgLayerRenderer public immutable dustR;

    constructor(
        address _colorRenderer,
        address _starsRenderer,
        address _spiralRenderer,
        address _nebulaRenderer,
        address _dustRenderer
    ) {
        if (_colorRenderer == address(0)) revert BG_BAD_RENDERER(0);
        if (_starsRenderer == address(0)) revert BG_BAD_RENDERER(1);
        if (_spiralRenderer == address(0)) revert BG_BAD_RENDERER(2);
        if (_nebulaRenderer == address(0)) revert BG_BAD_RENDERER(3);
        if (_dustRenderer == address(0)) revert BG_BAD_RENDERER(4);

        colorR  = IBgLayerRenderer(_colorRenderer);
        starsR  = IBgLayerRenderer(_starsRenderer);
        spiralR = IBgLayerRenderer(_spiralRenderer);
        nebulaR = IBgLayerRenderer(_nebulaRenderer);
        dustR   = IBgLayerRenderer(_dustRenderer);

        // Touch atlas() once so bad addresses fail fast during deployment.
        // (If these revert, your input addresses are wrong / not renderers.)
        colorR.atlas();
        starsR.atlas();
        spiralR.atlas();
        nebulaR.atlas();
        dustR.atlas();
    }

    function _pick(uint256 seed, uint256 salt, uint256 max) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(seed, salt))) % max;
    }

    function renderBg(uint256 seed) external view returns (string memory) {
        uint256 cN  = colorR.count();
        uint256 sN  = starsR.count();
        uint256 spN = spiralR.count();
        uint256 nN  = nebulaR.count();
        uint256 dN  = dustR.count();

        if (cN == 0 || sN == 0 || spN == 0 || nN == 0 || dN == 0) revert BG_BAD_COUNTS();

        uint256 cId  = _pick(seed, 1, cN);
        uint256 sId  = _pick(seed, 2, sN);
        uint256 spId = _pick(seed, 3, spN);
        uint256 nId  = _pick(seed, 4, nN);
        uint256 dId  = _pick(seed, 5, dN);

        return renderBgFromIds(cId, sId, spId, nId, dId);
    }

    function renderBgFromIds(
        uint256 cId,
        uint256 sId,
        uint256 spId,
        uint256 nId,
        uint256 dId
    ) public view returns (string memory) {
        string memory cFrag = _render(colorR,  cId,  0);
        string memory sFrag = _render(starsR,  sId,  1);
        string memory spFrag= _render(spiralR, spId, 2);
        string memory nFrag = _render(nebulaR, nId,  3);
        string memory dFrag = _render(dustR,   dId,  4);

        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">',
            cFrag, sFrag, spFrag, nFrag, dFrag,
            "</svg>"
        );
    }

    function _render(IBgLayerRenderer r, uint256 id, uint8 layer) internal view returns (string memory) {
        try r.render(id) returns (string memory out) {
            return out;
        } catch (bytes memory data) {
            revert BG_LAYER_FAIL(layer, data);
        }
    }
}