// The tokens of this contract are licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (https://creativecommons.org/licenses/by-nc-sa/4.0/)
// SPDX-License-Identifier:  CC-BY-NC-SA-4.0
pragma solidity ^0.8.0;

import "./LadybugFinances.sol";


/**
 * @author WrightCode
 * @title Ladybug Minter
 * @dev Controls the information around minting and mint-related data
 */
contract LadybugMinter is LadybugFinances {

    uint private constant DROP_TIME_TOLERANCE = 1728000; // (60*60*24)*20 = 20 days
    uint private constant PRICE_TIME_TOLERANCE = 864000; // (60*60*24)*10 = 10 days

    // the shuffled list of token ids
    uint16[_MAX_LADYBUGS] internal shuffle;

    /**
     * @dev Constructor shuffles the deck and premints.
     */
    constructor() LadybugFinances() {
        // create a shuffled array of tokenIds
        shuffle = _shuffle();
        // mint the first batch to owner & developer
        _mintReservedBugs();
    }

    /**
     * @dev Mint the remaining bugs in drop to owner if "stalled out".
     *
     * The drop is considered stalled if the drop began more than DROP_TIME_TOLERANCE days ago,
     * the price is less than 0.01 ETH and has been at that price for more than PRICE_TIME_TOLERANCE days.
     *
     * The idea being that if no one is minting the ladybugs after the price has been lowered,
     * then the owner may mint them.
     *
     * Please do not let them stall out, these ladybugs need new greener gardens.
     *
     * In other words, I will not abandon my ladybugs.
     */
    function mintStalledDropToOwner() external onlyOwner {

        (uint _index, bool _active, ) = _status();
        require (_active, "Drop not active");
        require (drops[_index].price <= 0.01 ether, "Price too high");
        require (drops[_index].date < block.timestamp - DROP_TIME_TOLERANCE, "Drop not active long enough");
        require (drops[_index].priceDate < block.timestamp - PRICE_TIME_TOLERANCE, "Price not active long enough");
        for (uint i = _currentSupplyIndex(); i < drops[_index].startAtIndex + _TOKENS_PER_DROP; i++) {
            _mintInternal(owner());
        }
    }

    /**
     * @dev Count the current number of ladybugs minted.
     */
    function totalMinted() external view returns (uint) {
        return _currentSupplyIndex();
    }

    /**
     * @dev Count the remaning, unminted ladybugs.
     */
    function unminted() external view returns (uint) {
        return uint(_MAX_LADYBUGS) - _currentSupplyIndex();
    }

    /**
     * @dev Mint the ERC 721 ladybug token, transfer it to the recipient.
     * The drop must be active and the payment must be above the specified drop price.
     */
    function mint(address recipient) external payable returns (uint) {
        // if there's no active drop, error is thrown
        (uint _index, bool _active, ) = _status();
        require (_active, "Drop not active");
        require (msg.value >= drops[_index].price, "Offer lower than price");
        return _mintInternal(recipient);
    }

    /**
     * @dev I believe this is necessary for OpenSea, there's no trailing slash.
     * The CID is the directory containing the nft metadata.
     */
    function contractURI() public pure returns (string memory) {
        // todo https://docs.opensea.io/docs/contract-level-metadata
        // this is the pinata directory of the numbers metadata
        return "ipfs://QmP6wnMSYwzEQHWgBZobKF2drEr4GpE66w9jN1p3HDwhUe";
    }

    /**
     * @dev Method used internally to construct the path to the token's metadata (json).
     * This is an ipfs uri with a trailing slash.
     */
    function _baseURI() internal virtual override pure returns (string memory) {
        return "ipfs://QmP6wnMSYwzEQHWgBZobKF2drEr4GpE66w9jN1p3HDwhUe/";
    }

    /**
     * @dev Mint the ERC 721 ladybug token, transfer it to the recipient.
     */
    function _mintInternal(address recipient) internal returns (uint) {
        // get the mint id from the shuffled array (it's zero based)
        uint newItemId = shuffle[_currentSupplyIndex()];
        _mint(recipient, newItemId);
        // increment the supply counter
        _incrementCurrentSupplyIndex();
        return newItemId;
    }

    /**
     * @dev Create an array of all the ladybug token ids, 1 to _MAX_LADYBUGS, then shuffle them.
     *
     *  This is a very simple distribution of the bugs, they're not part of a great reveal,
     * we're not looking to game anyone, they simply want a good home with someone that'll
     * appreciate them.  Perhaps my next project, with a larger budget, will merit a
     * more challenging and sophisticted mint.  That would be a lot of fun to work on.
     * Until then, enjoy the bugs as they are, they're ready to fly.
     *
     */
    function _shuffle() internal view returns (uint16[_MAX_LADYBUGS] memory) {
        // do this in memory to save on gas (fun fact: ladybug "gas" are aphids)
        uint16[_MAX_LADYBUGS] memory memoryArray;
        // populate an array from 1 to _MAX_LADYBUGS...
        for (uint i = 0; i < _MAX_LADYBUGS; i++) {
            memoryArray[i] = uint16(i+1);
        }
        // ... then shuffle it using this fisher yates algorithm...
        for (uint16 i = 0; i < memoryArray.length; i++) {
            uint16 n = uint16(i + uint256(keccak256(abi.encodePacked(block.timestamp))) % (memoryArray.length - i));
            uint16 temp = memoryArray[n];
            memoryArray[n] = memoryArray[i];
            memoryArray[i] = temp;
        }
        return memoryArray;
    }

    /**
     * @dev Mint the reserved ERC721 ladybug tokens to the dev team and owner.
     */
    function _mintReservedBugs() private onlyOwner {
        // the development team will get a handful of preminted (but random, shuffled) nfts...
        for (uint i = 0; i < _RESERVED_LADYBUGS_DEVELOPMENT; i++) {
            _mintInternal(_developmentTeamAddress);
        }
        // ...as will the owner of the contract
        for (uint i = 0; i < _RESERVED_LADYBUGS_OWNER; i++) {
            _mintInternal(owner());
        }
    }


}
