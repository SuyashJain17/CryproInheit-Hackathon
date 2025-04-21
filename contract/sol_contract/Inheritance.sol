// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title InheritanceContract
 * @dev A contract that allows multiple users to create inheritance plans
 * where beneficiaries can claim 50% of funds after a timeout period if the owner
 * doesn't reset the timer. The remaining 50% is retained for the protocol.
 */
contract InheritanceContract is ReentrancyGuard, Ownable {
    // Structure to hold inheritance configuration for each owner
    struct InheritanceConfig {
        bool active;                             // Flag to check if this config exists
        mapping(address => bool) beneficiaries;  // Beneficiaries (address => is_beneficiary)
        uint128 beneficiaryCount;                // Total number of beneficiaries
        uint256 lastReset;                       // Last reset timestamp (in seconds)
        uint256 timeoutPeriod;                   // Timeout period (in seconds)
        uint128 balance;                         // Total ETH balance locked
        mapping(address => bool) claimed;        // Has a beneficiary claimed their share
        uint128 perBeneficiaryShare;             // Per beneficiary share (locked when expired)
        bool shareLocked;                        // Flag to track if share calculation is locked
        uint128 protocolShare;                   // 50% of funds retained by protocol
    }

    // Mapping: owner => inheritance_config
    mapping(address => InheritanceConfig) private owners;

    // Total number of active owners
    uint256 public ownerCount;

    // Events
    event InheritancePlanCreated(address indexed owner, uint256 amount, uint256 timeoutPeriod);
    event FundsAdded(address indexed owner, uint256 amount);
    event BeneficiaryAdded(address indexed owner, address indexed beneficiary);
    event BeneficiaryRemoved(address indexed owner, address indexed beneficiary);
    event TimerReset(address indexed owner, uint256 newResetTime);
    event ShareLocked(address indexed owner, uint256 perBeneficiaryShare, uint256 protocolShare);
    event FundsClaimed(address indexed owner, address indexed beneficiary, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);
    event ProtocolShareWithdrawn(address indexed owner, uint256 amount);

    /**
     * @dev Constructor to set the protocol admin
     */
    constructor() Ownable(msg.sender) {}

    /**
     * @dev Create a new inheritance plan
     * @param initialBeneficiaries List of initial beneficiaries (max 5)
     * @param timeoutPeriodSeconds Timeout period in seconds (e.g., 300 for 5 minutes)
     */
    function createInheritancePlan(address[] calldata initialBeneficiaries, uint256 timeoutPeriodSeconds) external payable {
        address owner = msg.sender;
        require(!ownerExists(owner), "You already have an inheritance plan");
        require(timeoutPeriodSeconds > 0, "Invalid timeout period");
        require(msg.value > 0, "Must deposit funds");

        // Initialize owner's inheritance config
        InheritanceConfig storage config = owners[owner];
        config.active = true;
        config.timeoutPeriod = timeoutPeriodSeconds;
        config.lastReset = block.timestamp;
        config.balance = uint128(msg.value);
        config.shareLocked = false;

        // Add initial beneficiaries (max 5)
        uint128 count = 0;
        for (uint256 i = 0; i < initialBeneficiaries.length && i < 5; i++) {
            address beneficiary = initialBeneficiaries[i];
            if (beneficiary != address(0) && !config.beneficiaries[beneficiary]) {
                config.beneficiaries[beneficiary] = true;
                count++;
            }
        }
        config.beneficiaryCount = count;

        // Increment owner count
        ownerCount++;

        emit InheritancePlanCreated(owner, msg.value, timeoutPeriodSeconds);
    }

    /**
     * @dev Add funds to the inheritance plan
     */
    function addFunds() external payable {
        address owner = msg.sender;
        require(ownerExists(owner), "No inheritance plan found");
        require(msg.value > 0, "Must send funds");

        InheritanceConfig storage config = owners[owner];
        require(!config.shareLocked, "Plan has expired, cannot add funds");

        config.balance += uint128(msg.value);

        emit FundsAdded(owner, msg.value);
    }

    /**
     * @dev Add a beneficiary to the owner's plan
     * @param beneficiary Address of the beneficiary to add
     */
    function addBeneficiary(address beneficiary) external {
        address owner = msg.sender;
        require(ownerExists(owner), "No inheritance plan found");

        InheritanceConfig storage config = owners[owner];
        require(!config.shareLocked, "Plan has expired, cannot add beneficiary");
        require(config.beneficiaryCount < 5, "Max 5 beneficiaries");
        require(beneficiary != address(0), "Invalid beneficiary address");
        require(!config.beneficiaries[beneficiary], "Beneficiary already exists");

        config.beneficiaries[beneficiary] = true;
        config.beneficiaryCount++;

        emit BeneficiaryAdded(owner, beneficiary);
    }

    /**
     * @dev Remove a beneficiary from the owner's plan
     * @param beneficiary Address of the beneficiary to remove
     */
    function removeBeneficiary(address beneficiary) external {
        address owner = msg.sender;
        require(ownerExists(owner), "No inheritance plan found");

        InheritanceConfig storage config = owners[owner];
        require(!config.shareLocked, "Plan has expired, cannot remove beneficiary");
        require(config.beneficiaries[beneficiary], "Not a beneficiary");

        config.beneficiaries[beneficiary] = false;
        config.beneficiaryCount--;

        emit BeneficiaryRemoved(owner, beneficiary);
    }

    /**
     * @dev Reset the inheritance timer (equivalent to signing in)
     */
    function resetTimer() external {
        address owner = msg.sender;
        require(ownerExists(owner), "No inheritance plan found");

        InheritanceConfig storage config = owners[owner];
        require(!config.shareLocked, "Plan has expired, cannot reset timer");

        config.lastReset = block.timestamp;

        emit TimerReset(owner, block.timestamp);
    }

    /**
     * @dev Lock the per-beneficiary share amount for a specific owner
     * @param owner Address of the plan owner
     */
    function lockShare(address owner) public {
        require(ownerExists(owner), "Owner does not exist");
        require(isOwnerExpired(owner), "Plan not expired yet");

        InheritanceConfig storage config = owners[owner];
        require(!config.shareLocked, "Share already locked");

        uint128 count = config.beneficiaryCount;
        require(count > 0, "No beneficiaries");

        uint128 balance = config.balance;
        require(balance > 0, "No funds to distribute");

        // Calculate 50% for beneficiaries and 50% for protocol
        uint128 beneficiaryTotal = balance / 2;
        config.perBeneficiaryShare = beneficiaryTotal / count;
        config.protocolShare = balance - (config.perBeneficiaryShare * count); // Include remainder
        config.shareLocked = true;

        emit ShareLocked(owner, config.perBeneficiaryShare, config.protocolShare);
    }

    /**
     * @dev Redeem ETH by beneficiaries after timeout
     * @param owner Address of the plan owner
     */
    function redeem(address owner) external nonReentrant {
        require(ownerExists(owner), "Owner does not exist");
        require(isOwnerExpired(owner), "Plan not expired");

        address payable sender = payable(msg.sender);
        InheritanceConfig storage config = owners[owner];
        require(config.beneficiaries[sender], "Not a beneficiary");
        require(!config.claimed[sender], "Already claimed");

        // Lock share if not already locked
        if (!config.shareLocked) {
            lockShare(owner);
        }

        uint128 amount = config.perBeneficiaryShare;
        require(amount > 0, "No funds to redeem");

        // Mark beneficiary as claimed
        config.claimed[sender] = true;
        config.beneficiaries[sender] = false;
        config.beneficiaryCount--;
        config.balance -= amount;

        // If all funds claimed, deactivate the owner's config
        if (config.balance == 0 || config.beneficiaryCount == 0) {
            config.active = false;
            ownerCount--;
        }

        // Transfer funds
        (bool success, ) = sender.call{value: amount}("");
        if (!success) {
            // Revert state on failed transfer
            config.claimed[sender] = false;
            config.beneficiaries[sender] = true;
            config.beneficiaryCount++;
            config.balance += amount;

            // Restore owner if deactivated
            if (!config.active) {
                config.active = true;
                ownerCount++;
            }

            revert("Transfer failed");
        }

        emit FundsClaimed(owner, sender, amount);
    }

    /**
     * @dev Withdraw all funds (only owner can call before expiration)
     */
    function withdrawAll() external nonReentrant {
        address payable owner = payable(msg.sender);
        require(ownerExists(owner), "No inheritance plan found");

        InheritanceConfig storage config = owners[owner];
        require(!config.shareLocked, "Plan has expired, cannot withdraw");

        uint128 amount = config.balance;
        require(amount > 0, "No funds to withdraw");

        // Clear the balance before transfer to prevent reentrancy
        config.balance = 0;
        config.active = false;
        ownerCount--;

        // Transfer funds
        (bool success, ) = owner.call{value: amount}("");
        if (!success) {
            // Restore state on failed transfer
            config.balance = amount;
            config.active = true;
            ownerCount++;
            revert("Transfer failed");
        }

        emit FundsWithdrawn(owner, amount);
    }

    /**
     * @dev Withdraw the protocol's share (only protocol admin)
     * @param owner Address of the plan owner
     */
    function withdrawProtocolShare(address owner) external onlyOwner nonReentrant {
        require(ownerExists(owner), "Owner does not exist");

        InheritanceConfig storage config = owners[owner];
        require(config.shareLocked, "Share not locked");

        uint128 amount = config.protocolShare;
        require(amount > 0, "No protocol share to withdraw");

        config.protocolShare = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit ProtocolShareWithdrawn(owner, amount);
    }

    function getPlanDetails(address owner) external view returns (
        uint256 balance,
        uint256 beneficiaryCount,
        uint256 lastReset,
        uint256 timeoutPeriod,
        uint256 perBeneficiaryShare,
        bool shareLocked,
        uint256 protocolShare
    ) {
        require(ownerExists(owner), "Owner does not exist");

        InheritanceConfig storage config = owners[owner];
        return (
            config.balance,
            config.beneficiaryCount,
            config.lastReset,
            config.timeoutPeriod,
            config.perBeneficiaryShare,
            config.shareLocked,
            config.protocolShare
        );
    }

    /**
     * @dev Check if a specific owner's plan is expired
     * @param owner Address of the plan owner
     * @return True if the plan is expired
     */
    function isOwnerExpired(address owner) public view returns (bool) {
        require(ownerExists(owner), "Owner does not exist");

        InheritanceConfig storage config = owners[owner];
        return block.timestamp >= config.lastReset + config.timeoutPeriod;
    }

    /**
     * @dev Check if an address is a beneficiary of a specific owner
     * @param owner Address of the plan owner
     * @param beneficiary Address to check
     * @return True if the address is a beneficiary
     */
    function isBeneficiary(address owner, address beneficiary) external view returns (bool) {
        require(ownerExists(owner), "Owner does not exist");

        return owners[owner].beneficiaries[beneficiary];
    }

    /**
     * @dev Check if a beneficiary has claimed their share
     * @param owner Address of the plan owner
     * @param beneficiary Address to check
     * @return True if the beneficiary has claimed
     */
    function hasClaimed(address owner, address beneficiary) external view returns (bool) {
        require(ownerExists(owner), "Owner does not exist");

        return owners[owner].claimed[beneficiary];
    }

    /**
     * @dev Helper function to check if an owner exists
     * @param owner Address to check
     * @return True if the owner has an active plan
     */
    function ownerExists(address owner) public view returns (bool) {
        return owners[owner].active;
    }

    /**
     * @dev Get time remaining before a plan expires
     * @param owner Address of the plan owner
     * @return Time remaining in seconds, 0 if already expired
     */
    function timeRemaining(address owner) external view returns (uint256) {
        require(ownerExists(owner), "Owner does not exist");

        InheritanceConfig storage config = owners[owner];
        uint256 expiryTime = config.lastReset + config.timeoutPeriod;

        if (block.timestamp >= expiryTime) {
            return 0;
        }

        return expiryTime - block.timestamp;
    }


/**
 * @dev Get all beneficiaries for a specific owner
 * @param owner Address of the plan owner
 * @return Array of beneficiary addresses
 */
function getAllBeneficiaries(address owner) external view returns (address[] memory) {
    require(ownerExists(owner), "Owner does not exist");
    
    InheritanceConfig storage config = owners[owner];
    uint256 count = config.beneficiaryCount;
    
    address[] memory beneficiaries = new address[](count);
    
    if (count > 0) {
        uint256 index = 0;
        
        // This is inefficient but necessary since we don't store beneficiary addresses in an array
        for (uint256 i = 0; i < 10000 && index < count; i++) {
            address potentialBeneficiary = address(uint160(i));
            if (config.beneficiaries[potentialBeneficiary]) {
                beneficiaries[index] = potentialBeneficiary;
                index++;
            }
        }
    }
    
    return beneficiaries;
}

/**
 * @dev Get total active beneficiary count for a plan
 * @param owner Address of the plan owner
 * @return Total number of active beneficiaries
 */
function getActiveBeneficiaryCount(address owner) external view returns (uint256) {
    require(ownerExists(owner), "Owner does not exist");
    return owners[owner].beneficiaryCount;
}

/**
 * @dev Get detailed information about a beneficiary's status
 * @param owner Address of the plan owner
 * @param beneficiary Address of the beneficiary
 * @return isbeneficiary Whether the address is a beneficiary
 * @return hasclaimed Whether the beneficiary has claimed their share
 * @return potentialShare The share they would receive (if plan is expired)
 */
function getBeneficiaryDetails(address owner, address beneficiary) external view returns (
    bool isbeneficiary,
    bool hasclaimed,
    uint256 potentialShare
) {
    require(ownerExists(owner), "Owner does not exist");
    
    InheritanceConfig storage config = owners[owner];
    
    isbeneficiary = config.beneficiaries[beneficiary];
    hasclaimed = config.claimed[beneficiary];
    
    // Calculate potential share (either locked amount or estimated amount)
    if (config.shareLocked) {
        potentialShare = isbeneficiary ? config.perBeneficiaryShare : 0;
    } else {
        potentialShare = (config.beneficiaryCount > 0 && isbeneficiary) ? 
            (config.balance / 2) / config.beneficiaryCount : 0;
    }
    
    return (isbeneficiary, hasclaimed, potentialShare);
}

/**
 * @dev Get extended plan details including expiry status
 * @param owner Address of the plan owner
 * @return balance Current balance
 * @return totalBeneficiaries Total number of beneficiaries
 * @return lastResetTime Last reset timestamp
 * @return timeout Timeout period in seconds
 * @return isExpired Whether the plan is expired
 * @return expiryTime Timestamp when plan will expire
 */
function getExtendedPlanDetails(address owner) external view returns (
    uint256 balance,
    uint256 totalBeneficiaries,
    uint256 lastResetTime,
    uint256 timeout,
    bool isExpired,
    uint256 expiryTime
) {
    require(ownerExists(owner), "Owner does not exist");
    
    InheritanceConfig storage config = owners[owner];
    
    expiryTime = config.lastReset + config.timeoutPeriod;
    isExpired = block.timestamp >= expiryTime;
    
    return (
        config.balance,
        config.beneficiaryCount,
        config.lastReset,
        config.timeoutPeriod,
        isExpired,
        expiryTime
    );
}

/**
 * @dev Get statistical information about the contract
 * @return activePlans Total number of active inheritance plans
 * @return totalBalance Total ETH locked in the contract
 */
function getContractStats() external view returns (
    uint256 activePlans,
    uint256 totalBalance
) {
    activePlans = ownerCount;
    totalBalance = address(this).balance;
    
    return (activePlans, totalBalance);
}

/**
 * @dev Check if an owner's plan exists and is active
 * @param owner Address to check
 * @return active True if owner has an active plan
 * @return expired True if plan exists but has expired
 */
function checkPlanStatus(address owner) external view returns (bool active, bool expired) {
    active = ownerExists(owner);
    
    if (active) {
        expired = isOwnerExpired(owner);
    } else {
        expired = false;
    }
    
    return (active, expired);
}

/**
 * @dev Get the protocol share amount for a specific owner's plan
 * @param owner Address of the plan owner
 * @return share Current protocol share amount
 * @return shareLocked Whether the share has been locked
 */
function getProtocolShare(address owner) external view returns (uint256 share, bool shareLocked) {
    require(ownerExists(owner), "Owner does not exist");
    
    InheritanceConfig storage config = owners[owner];
    
    return (config.protocolShare, config.shareLocked);
}
}