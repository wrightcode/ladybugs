pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev The base-layer data for the Ladybug ERC721 tokens.
 */
contract LadybugFactory is Ownable, ERC721 {

    /**
        The maximum number of ladybugs and the number that are reserved
        for the owner, airdrops, giveaways, or for early sale on open sea.
     */
    // uint16 internal constant _MAX_LADYBUGS = 1440; 
    // uint8 internal constant _RESERVED_LADYBUGS = 96;
    // TODO - THIS IS DEBUG ONLY WITH NUMBERS...
    uint16 internal constant _MAX_LADYBUGS = 24; 
    uint16 internal constant _RESERVED_LADYBUGS = 4;
    uint16 internal constant _TOKENS_PER_DROP = (_MAX_LADYBUGS - _RESERVED_LADYBUGS) / 4;

    struct Ladybug {
        uint tokenId;
    }

    Ladybug[] internal ladybugs;

    // ordered by size for optimization
    struct Drop {
        uint256 price;        // needs to be in wei (eth * 10^18)
        uint256 date;         // uint in seconds since epoch
        uint256 price_date;   // date the current price went into effect
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
    constructor() ERC721("Ladybug Power", "LADBYBUG") {
        uint16 startAtIndex = _RESERVED_LADYBUGS;
        for (uint8 i = 0; i < drops.length; i++) {
            drops[i] = Drop(0.015 ether, 0, 0, startAtIndex);
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
     * @dev Return array of ladybug token Ids owned by _owner.
     */
    function getLadybugIdsByOwner(address _owner) external view returns(uint[] memory) {
        uint[] memory result = new uint[](balanceOf(_owner));
        uint16 counter = 0;
        for (uint16 i = 0; i < ladybugs.length; i++) {
          if (ownerOf(ladybugs[i].tokenId) == _owner) {
            result[counter] = ladybugs[i].tokenId;
            counter++;
          }
        }
        return result;
    }

}
