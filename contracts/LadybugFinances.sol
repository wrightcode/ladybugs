pragma solidity ^0.8.0;

import "./LadybugDrops.sol";

/**
 * @dev Encapsulate the financial side of 
 */
contract LadybugFinances is LadybugDrops {//, RoyaltiesV2Impl {

	bytes4 private constant _INTERFACE_ID_ERC2981 = 0x2a55205a;
    uint16 internal constant _DEFAULT_ROYALTY_VALUE = 250; // 2.5%
    uint16 internal constant _MAX_ROYALTY_VALUE = 450; // 4.5%

    address internal _royaltyRecipient;
    uint16 private _royaltyBasis = _DEFAULT_ROYALTY_VALUE;

    /**
     * @dev Sets initial royalty recipient to be the owner()
     */
    constructor() {
        _royaltyRecipient = owner();
    }

    /**
     * @dev Modifier that restricts how high the royalties can be.
     */
    modifier royaltiesConstraint(uint16 basis) {
        // restrict the royalties to 4.5% at the most
        require(_MAX_ROYALTY_VALUE >= basis);
        _;
    }

    /**
     * @dev Supports Interface for ERC-2981
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721) returns (bool) {
        if(interfaceId == _INTERFACE_ID_ERC2981) {
            return true;
        }
        return super.supportsInterface(interfaceId);
    } 

    /**
     * @dev ERC-2981 interface to retriee royalty information by any service that adheres to the standard and pays royalties.
     * Some implementations use per-tokenId configurations, but this implementation uses the same recipient and royalty basis
     * for all tokens.
     */
    function royaltyInfo(uint256 _tokenId, uint256 _salePrice) external view returns (address receiver, uint256 royaltyAmount) {
        return (payable(_royaltyRecipient), uint((_salePrice * _royaltyBasis)/10000));
    }

    /**
     * @dev View the royalty recipient and basis values.
     */
    function getLadybugRoyaltyInfo() external view returns (address receiver, uint16 basis) {
        return (_royaltyRecipient, _royaltyBasis);
    }

    /**
     * @dev Allows owner to change the royalties and recipient of royalties.
     */
    function setLadybugRoyaltyInfo(address _recipient, uint16 _basis) external royaltiesConstraint(_basis) onlyOwner {
        _royaltyRecipient = _recipient;
        _royaltyBasis = _basis;
    }

    /**
     * @dev Display the balance of funds in the contract, onlyOwner.
     */
    function balanceInContract() view public onlyOwner returns(uint) {
        return address(this).balance;
    }

    /**
     * @dev Allows owner to transfer funds from contract, effectively paying himself.
     */
    function withdraw() external onlyOwner returns(uint) {
        address _owner = owner();
        uint balance = address(this).balance;
        payable(_owner).transfer(balance);
        return balance;
    }

}