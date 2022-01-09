pragma solidity >=0.4.22 <0.9.0;

import "./LadybugFactory.sol";

/**
 * @dev Encapsulates the data surrounding the 4 ladybug "drops".
 */
contract LadybugDrops is LadybugFactory {

    /**
     * @dev Modifier that prevents a date change once a drop has started.
     */
   	modifier dropNotStarted(uint _index, uint _date) {
		// the drop we're updating can't be starting within the hour.
    	require(drops[_index].date == 0 || drops[_index].date > block.timestamp + (60 * 60));
    	// the _date value must be two hours out from now
    	require(_date > block.timestamp + (2 * 60 * 60));
    	_;
  	}

    /**
     * @dev Modifier to ensure a price change on an active drop will be a descrease.
     * Not allowing price increases on active drops.
     */
   	modifier priceNotIncreased(uint _index, uint _price) {
		// the new price must be lower
    	require(drops[_index].price > _price);
    	// price drop must be for current or future drop
    	require(_index >= _currentDropIndex());
    	_;
  	}

    /**
     * @dev Return an array of all the drops.
     */
    function getDrops() view external returns (Drop[] memory) {
        Drop[] memory results = new Drop[](drops.length);
        for (uint i = 0; i < drops.length; i++) {
            results[i] = drops[i];
        }
        return results;
    }

    /**
     * @dev Update the price and date of non-active drops only.
     */
    function updateDrop(uint _index, uint _price, uint _date) 
    	external dropNotStarted(_index, _date) onlyOwner {
        drops[_index].price = _price;
        drops[_index].date = _date;
    }

    /**
     * @dev Decrease the price of an active drop.  Useful if drops "stall out".
     */
    function dropPrice(uint _index, uint _price) 
    	external priceNotIncreased(_index, _price) onlyOwner {
        drops[_index].price = _price;
    }

    /**
     * @dev Returns the next drop index that is not complete.  It does not need to be active.
     */
    function _currentDropIndex() private view returns (uint) {
    	// there'll be no current drop if minting is complete
    	if (ladybugs.length >= uint(_MAX_LADYBUGS)) revert('Minting is complete.');

    	for (uint i = drops.length - 1; i >= 0; i--) {
    		if (ladybugs.length >= drops[i].startAtIndex) {
    			return i;
			}
    	}
    	revert('No active drop');
    }

    /**
     * @dev An active drop has a non-zero date and is not in the future.
     */
    function activeDrop() public view returns (Drop memory) {
    	Drop memory current = drops[_currentDropIndex()];
    	// the dro must be active, which means there's a date set and not in the future
    	if (current.date == 0 || current.date > block.timestamp) revert('No active drop');
    	return current;
    }

}
