pragma solidity >=0.4.22 <0.9.0;

import "./LadybugFactory.sol";

/**
 * @dev Encapsulates the data surrounding the 4 ladybug "drops".
 */
contract LadybugDrops is LadybugFactory {

    /**
     * @dev Modifier that prevents a date change once a drop has started.
     */
   	modifier dropNotStarted(uint8 _index, uint _date) {
		// the drop we're updating can't be starting within the hour.
    	require(drops[_index].date == 0 || drops[_index].date > block.timestamp + (60 * 60), 'Drop starting too soon to change');
    	// the _date value must be two hours out from now
    	require(_date > block.timestamp + (2 * 60 * 60), 'New start date too close');
    	_;
  	}

    /**
     * @dev Modifier to ensure a price change on an active drop will be a descrease.
     * Not allowing price increases on active drops.
     */
   	modifier priceNotIncreased(uint8 _index, uint _price) {
		// the new price must be lower
    	require(drops[_index].price > _price, 'Price cannot increase');
    	// price drop must be for current or future drop
    	require(_index >= _currentDropIndex(), 'Drop has already completed');
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
    function updateDrop(uint8 _index, uint _price, uint _date) 
    	external dropNotStarted(_index, _date) onlyOwner {
        drops[_index].price = _price;
        drops[_index].date = _date;
        // the price will go into effect on _date
        drops[_index].price_date = _date;
    }

    /**
     * @dev Decrease the price of an active drop.  Useful if drops "stall out".
     */
    function dropPrice(uint8 _index, uint _price) 
    	external priceNotIncreased(_index, _price) onlyOwner {
        drops[_index].price = _price;
        // the price will go into effect now, if the drops[_index].date < block.timestamp;
        if (drops[_index].date < block.timestamp) {
        	// drop is active, so set new price_date
        	drops[_index].price_date = block.timestamp;
        }
    }

    /**
     * @dev Returns the current drop (0-3) in which the next ladybug would be minted.
     * This does not take the drop date into account, so it might not be an active drop.
     */
    function _currentDropIndex() internal view returns (uint8) {
    	for (uint i = drops.length - 1; i >= 0; i--) {
    		if (ladybugs.length >= drops[i].startAtIndex) {
    			return uint8(i);
			}
    	}
    	// should never reach this line of code
    	revert('Error in _currentDropIndex');
    }

    /**
     * @dev Same call as status, but this one is 'internal'.  Breaking out the two
     * is being done for gas efficiency, when status is needed internally.
     */
    function status_internal() internal view returns (uint index, bool active, bool complete) {
    	uint8 currentIndex = _currentDropIndex();
    	bool isComplete = ladybugs.length >= _MAX_LADYBUGS;
    	// a drop is active if all drops are not complete, the date is non-zero, 
    	// and the blockchain time is greater than the drop date.
    	bool isActive = isComplete != true && drops[currentIndex].date != 0 && drops[currentIndex].date <= block.timestamp;
		return (currentIndex, isActive, isComplete);
     }

    /**
     * @dev Return the current drop index and whether it's active or not.
     */
    function status() external view returns (uint index, bool active, bool complete) {
    	return status_internal();
    }

}
