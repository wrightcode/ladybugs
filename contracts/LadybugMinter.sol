pragma solidity ^0.8.0;

import "./LadybugFinances.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @dev Controls the information around minting and mint-related data
 */
contract LadybugMinter is LadybugFinances {

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    /**
     * @dev Constructor mints the reserved ladybugs to the owner()
     */
    constructor() LadybugFinances() {
        mintReservedBugs();
    }

    /**
     * @dev Mint the reserved ERC721 tokens to the owner().
     */
    function mintReservedBugs() private onlyOwner {
        for (uint8 i = 0; i < _RESERVED_LADYBUGS; i++) {
            _mintInternal(owner());
        }
    }

    /**
     * @dev Count the current number of tokens minted.
     */
    function totalMinted() public view returns (uint) {
        return _tokenIds.current();
    }

    /**
     * @dev Count the remaning, unminted tokens.
     */
    function unminted() public view returns (uint) {
        return uint(_MAX_LADYBUGS) - _tokenIds.current();
    }

    /**
     * @dev Mint the ERC 721 token, transfer it to the recipient.
     * The drop must be active and the payment must be above the specified drop price.
     */
    function mint(address recipient) external payable returns (uint) {
        // if there's no active drop, error is thrown
        Drop memory activeDrop = activeDrop();
        require (msg.value >= activeDrop.price);
        return _mintInternal(recipient);
    }

    /**
     * @dev Mint the ERC 721 token, transfer it to the recipient.
     */
    function _mintInternal(address recipient) internal returns (uint) {
        _tokenIds.increment();

        uint newItemId = _tokenIds.current();
        _mint(recipient, newItemId);

        ladybugs.push(Ladybug(newItemId));

        return newItemId;
    }

    /**
     * @dev Method used internally to construct the path to the token's metadata (json).
     * This is an ipfs uri with a trailing slash.
     */
    function _baseURI() internal virtual override pure returns (string memory) {
        return "ipfs://QmdUBpQ8tgeSB8cdkPpdawvvaXrubzBKVuKfygxtFAnhmW/";
    }

    /**
     * @dev I believe this is necessary for OpenSea, there's no trailing slash.
     * The CID is the directory containing the nft metadata.
     */
    function contractURI() public pure returns (string memory) {
        // todo https://docs.opensea.io/docs/contract-level-metadata
        // this is the pinata directory of the numbers metadata
        return "ipfs://QmdUBpQ8tgeSB8cdkPpdawvvaXrubzBKVuKfygxtFAnhmW";
    }

}
