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
    uint8 internal constant _RESERVED_LADYBUGS = 4;
    uint16 internal constant _TOKENS_PER_DROP = (_MAX_LADYBUGS - _RESERVED_LADYBUGS) / 4;

    struct Ladybug {
        uint tokenId;
    }

    Ladybug[] internal ladybugs;

    struct Drop {
        uint number;       // 1 to 4 (number of the drop), 0 would be the pre-mint at deployment
        uint startAtIndex; // the ladybugs index at which this drop would begin
        uint price;        // needs to be in wei (eth * 10^18)
        uint date;         // uint in seconds since epoch
    }

    /**
        There will be four drops.  Price & date can be configured by owner.
        
        The next four will each be (_MAX_LADYBUGS - _RESERVED_LADYBUGS)/4 ladybugs, 
        with a configurable drop date and price.  

        The first drop will be scheduled immediately, at the block.timestamp.
     */
    Drop[4] internal drops;

    /**
     * @dev There are four drops, 1-4 in the drops array.
     */
    constructor() ERC721("LadybugMinter", "NFT") {
        uint startAtIndex = _RESERVED_LADYBUGS;
        for (uint i = 1; i <= drops.length; i++) {
            // set the first drop date active
            uint dropdate = i == 1 ? block.timestamp : 0;
            drops[i-1] = Drop(i, startAtIndex, 0.015 ether, dropdate);
            startAtIndex += _TOKENS_PER_DROP;
        }
    }

    /**
     * @dev The total supply of all ladybug tokens.
     */
    function totalSupply() public pure returns (uint16) {
        return _MAX_LADYBUGS;
    }

    /**
     * @dev Constant, number of tokens per drop.
     */
    function tokensPerDrop() public pure returns (uint16) {
        return _TOKENS_PER_DROP;
    }

    /**
     * @dev Return array of ladybug token Ids owned by _owner.
     */
    function getLadybugIdsByOwner(address _owner) external view returns(uint[] memory) {
        uint[] memory result = new uint[](balanceOf(_owner));
        uint counter = 0;
        for (uint i = 0; i < ladybugs.length; i++) {
          if (ownerOf(ladybugs[i].tokenId) == _owner) {
            result[counter] = ladybugs[i].tokenId;
            counter++;
          }
        }
        return result;
    }

    /**
     * @dev Return array of Ladybug objects owned by _owner.
     */
    function getLadybugsByOwner(address _owner) external view returns(Ladybug[] memory) {
        Ladybug[] memory result = new Ladybug[](balanceOf(_owner));
        uint counter = 0;
        for (uint i = 0; i < ladybugs.length; i++) {
          if (ownerOf(ladybugs[i].tokenId) == _owner) {
            result[counter] = ladybugs[i];
            counter++;
          }
        }
        return result;
    }


}
