pragma solidity ^0.8.0;

import "./LadybugFinances.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @dev Controls the information around minting and mint-related data
 */
contract LadybugMinter is LadybugFinances {

    uint private constant DROP_TIME_TOLERANCE = (60*60*24)*30; // 30 days, ~1 month
    uint private constant PRICE_TIME_TOLERANCE = (60*60*24)*14; // 14 days (2 weeks)

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
        for (uint i = 0; i < _RESERVED_LADYBUGS; i++) {
            _mintInternal(owner());
        }
    }

    /**
     * @dev Mint the remaining bugs in drop to owner, if stalled out (mint began > 1 month and price <= 0.001 ETH.
     * The idea being that if no one is minting the ladybugs and the price has been lowered
     * to entince more minting, then the owner may mint them.
     */
    function mintStalledDropToOwner() external onlyOwner {

        (uint _index, bool _active, bool _complete) = status_internal();
        require (_active, 'Drop not active');
        require (drops[_index].date < block.timestamp - DROP_TIME_TOLERANCE, 'Drop not active long enough');
        require (drops[_index].price <= 0.001 ether, 'Price too high');
        require (drops[_index].price_date < block.timestamp - PRICE_TIME_TOLERANCE, 'Price not active long enough');
        for (uint i = ladybugs.length; i < drops[_index].startAtIndex + _TOKENS_PER_DROP; i++) {
            _mintInternal(owner());
        }
    }

    /**
     * @dev Count the current number of tokens minted.
     */
    function totalMinted() external view returns (uint) {
        return _tokenIds.current();
    }

    /**
     * @dev Count the remaning, unminted tokens.
     */
    function unminted() external view returns (uint) {
        return uint(_MAX_LADYBUGS) - _tokenIds.current();
    }

    /**
     * @dev Mint the ERC 721 token, transfer it to the recipient.
     * The drop must be active and the payment must be above the specified drop price.
     */
    function mint(address recipient) external payable returns (uint) {
        // if there's no active drop, error is thrown
        (uint _index, bool _active, bool _complete) = status_internal();
        require (_active, 'Drop not active');
        require (msg.value >= drops[_index].price, 'Offer lower than price');
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
