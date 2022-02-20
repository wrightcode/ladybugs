// The tokens of this contract are licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (https://creativecommons.org/licenses/by-nc-sa/4.0/)
// SPDX-License-Identifier:  CC-BY-NC-SA-4.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";


/**
 * @author WrightCode
 * @title Ladybug Factory
 * @dev The base-layer data for the Ladybug ERC721 tokens.
 */
contract LadybugFactory is Ownable, ERC721 {

    address internal _developmentTeamAddress = 0x3254C065f85167003F165E134A391a6ec2c26279;

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    uint16 internal constant _MAX_LADYBUGS = 1120;
    uint16 internal constant _RESERVED_LADYBUGS_DEVELOPMENT = 64;
    uint16 internal constant _RESERVED_LADYBUGS_OWNER = 32;

    uint16 internal constant _RESERVED_LADYBUGS = _RESERVED_LADYBUGS_DEVELOPMENT + _RESERVED_LADYBUGS_OWNER;
    uint16 internal constant _TOKENS_PER_DROP = (_MAX_LADYBUGS - _RESERVED_LADYBUGS) / 4;

    struct Drop {
        uint256 price;        // needs to be in wei (eth * 10^18)
        uint256 date;         // uint in seconds since epoch
        uint256 priceDate;   // date the current price went into effect
        uint16 startAtIndex; // the ladybugs index at which this drop would begin
    }

    /**
        There will be four drops.  Price & date can be configured by owner.

        The next four will each be (_MAX_LADYBUGS - _RESERVED_LADYBUGS)/4 ladybugs,
        with a configurable drop date and price.
     */
    Drop[4] internal drops;

    /**
     * @dev There are four drops, 1-4 in the drops array.
     */
    constructor() ERC721("Ladybug Power", "LADYBUG") {
        uint16 startAtIndex = _RESERVED_LADYBUGS;
        for (uint8 i = 0; i < drops.length; i++) {
            drops[i] = Drop(
                0.0333 ether, // less than a third of a tenth of an eth  :-)
                0,
                0,
                startAtIndex);
            startAtIndex += _TOKENS_PER_DROP;
        }
    }

    /**
     * @dev The total supply of all ladybug tokens.
     */
    function totalSupply() external pure returns (uint16) {
        return _MAX_LADYBUGS;
    }

    /**
     * @dev Constant, number of tokens per drop.
     */
    function tokensPerDrop() external pure returns (uint16) {
        return _TOKENS_PER_DROP;
    }

    /**
     * @dev Return array of ladybug token Ids owned by the address.
     */
    function getLadybugIdsByOwner(address bugOwner) external view returns(uint[] memory) {
        uint[] memory result = new uint[](balanceOf(bugOwner));
        uint16 counter = 0;
        for (uint16 i = 1; i <= _MAX_LADYBUGS; i++) {
            if (_exists(i) && ownerOf(i) == bugOwner) {
                result[counter] = i;
                counter++;
            }
        }
        return result;
    }

    /**
     * @dev Increment the current supply index by one.
     */
    function _incrementCurrentSupplyIndex() internal {
        _tokenIds.increment();
    }

    /**
     * @dev The index of the next mint from the supply. Aka, current mint position.
     */
    function _currentSupplyIndex() internal view returns (uint) {
        return _tokenIds.current();
    }

}
