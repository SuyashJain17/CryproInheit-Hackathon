extern crate alloc;

use stylus_sdk::{
    alloy_primitives::{Address, U256},
    evm, msg,
    prelude::*,
    storage::{StorageAddress, StorageBool, StorageMap, StorageU256, SimpleStorageType},
};

// Define storage for the contract
#[storage]
#[entrypoint]
pub struct InheritanceContract {
    // Mapping: owner => inheritance_config
    owners: StorageMap<Address, InheritanceConfig>,
    // Total number of active owners
    owner_count: StorageU256,
    // Protocol admin (equivalent to Ownable)
    admin: StorageAddress,
    // Reentrancy guard
    locked: StorageBool,
}

// Define storage for InheritanceConfig
#[storage]
pub struct InheritanceConfig {
    // Flag to check if this config exists
    active: StorageBool,
    // Beneficiaries (address => is_beneficiary)
    beneficiaries: StorageMap<Address, StorageBool>,
    // Total number of beneficiaries
    beneficiary_count: StorageU256,
    // Last reset timestamp (in seconds)
    last_reset: StorageU256,
    // Timeout period (in seconds)
    timeout_period: StorageU256,
    // Total ETH balance locked
    balance: StorageU256,
    // Has a beneficiary claimed their share
    claimed: StorageMap<Address, StorageBool>,
    // Per beneficiary share (locked when expired)
    per_beneficiary_share: StorageU256,
    // Flag to track if share calculation is locked
    share_locked: StorageBool,
    // 50% of funds retained by protocol
    protocol_share: StorageU256,
}

// Implement public functions
#[public]
impl InheritanceContract {
    // Initialize the contract (sets the admin)
    fn initialize(&mut self) {
        require(self.admin.get().is_zero(), "Already initialized");
        self.admin.set(self.vm().msg_sender());
    }

    // Create a new inheritance plan
    #[payable]
    fn create_inheritance_plan(&mut self, initial_beneficiaries: Vec<Address>, timeout_period_seconds: U256) {
        let owner = self.vm().msg_sender();
        require(!self.owner_exists(owner), "You already have an inheritance plan");
        require(timeout_period_seconds > U256::from(0), "Invalid timeout period");
        let msg_value = self.vm().msg_value();
        require(msg_value > U256::from(0), "Must deposit funds");

        let mut config = self.owners.get(owner);
        config.active.set(true);
        config.timeout_period.set(timeout_period_seconds);
        config.last_reset.set(U256::from(self.vm().block_timestamp()));
        config.balance.set(msg_value);
        config.share_locked.set(false);

        let mut count = U256::from(0);
        for beneficiary in initial_beneficiaries.iter().take(5) {
            if !beneficiary.is_zero() && !config.beneficiaries.get(*beneficiary) {
                config.beneficiaries.insert(*beneficiary, true);
                count += U256::from(1);
            }
        }
        config.beneficiary_count.set(count);
        self.owners.insert(owner, config);

        self.owner_count.set(self.owner_count.get() + U256::from(1));
        // Emit InheritancePlanCreated event
    }

    // Add funds to the inheritance plan
    #[payable]
    fn add_funds(&mut self) {
        let owner = self.vm().msg_sender();
        require(self.owner_exists(owner), "No inheritance plan found");
        let msg_value = self.vm().msg_value();
        require(msg_value > U256::from(0), "Must send funds");
        let mut config = self.owners.get(owner);
        require(!config.share_locked.get(), "Plan has expired, cannot add funds");
        let current_balance = config.balance.get();
        config.balance.set(current_balance + msg_value);
        self.owners.insert(owner, config);
        // Emit FundsAdded event
    }

    // Add a beneficiary
    fn add_beneficiary(&mut self, beneficiary: Address) {
        let owner = self.vm().msg_sender();
        require(self.owner_exists(owner), "No inheritance plan found");
        let mut config = self.owners.get(owner);
        require(!config.share_locked.get(), "Plan has expired, cannot add beneficiary");
        require(config.beneficiary_count.get() < U256::from(5), "Max 5 beneficiaries");
        require(!beneficiary.is_zero(), "Invalid beneficiary address");
        require(!config.beneficiaries.get(beneficiary), "Beneficiary already exists");
        config.beneficiaries.insert(beneficiary, true);
        config.beneficiary_count.set(config.beneficiary_count.get() + U256::from(1));
        self.owners.insert(owner, config);
        // Emit BeneficiaryAdded event
    }

    // Remove a beneficiary
    fn remove_beneficiary(&mut self, beneficiary: Address) {
        let owner = self.vm().msg_sender(); 
        require(self.owner_exists(owner), "No inheritance plan found");
        let mut config = self.owners.get_mut(owner);
        require(!config.share_locked.get(), "Plan has expired, cannot remove beneficiary");
        require(config.beneficiaries.get(beneficiary), "Not a beneficiary");
        config.beneficiaries.insert(beneficiary, false);
        let current_count = config.beneficiary_count.get();
        config.beneficiary_count.set(current_count - U256::from(1));
        // Emit BeneficiaryRemoved event
    }

    // Reset the inheritance timer
    fn reset_timer(&mut self) {
        let owner = self.vm().msg_sender();
        require(self.owner_exists(owner), "No inheritance plan found");
        let mut config = self.owners.get(owner);
        require(!config.share_locked.get(), "Plan has expired, cannot reset timer");
        config.last_reset.set(U256::from(self.vm().block_timestamp())); 
        // Emit TimerReset event
    }

    // Lock the per-beneficiary share amount
    fn lock_share(&mut self, owner: Address) {
        require(self.owner_exists(owner), "Owner does not exist");
        require(self.is_owner_expired(owner), "Plan not expired yet");
        let config = self.owners.get(owner);
        require(!config.share_locked.get(), "Share already locked");
        let count = config.beneficiary_count.get();
        require(count > U256::from(0), "No beneficiaries");
        let balance = config.balance.get();
        require(balance > U256::from(0), "No funds to distribute");
        let beneficiary_total = balance / U256::from(2);
        let per_beneficiary_share = beneficiary_total / count;
        let protocol_share = balance - (per_beneficiary_share * count);
        config.per_beneficiary_share.set(per_beneficiary_share);
        config.protocol_share.set(protocol_share);
        config.share_locked.set(true);
        // Emit ShareLocked event
    }

    // Redeem ETH by beneficiaries after timeout
    fn redeem(&mut self, owner: Address) {
        require(!self.locked.get(), "Reentrancy guard");
        self.locked.set(true);
        require(self.owner_exists(owner), "Owner does not exist");
        require(self.is_owner_expired(owner), "Plan not expired");
        let sender = msg::sender();
        let config = self.owners.get(owner);
        require(config.beneficiaries.get(sender).unwrap_or(false), "Not a beneficiary");
        require(!config.claimed.get(sender).unwrap_or(false), "Already claimed");
        if !config.share_locked.get() {
            self.lock_share(owner);
        }
        let amount = config.per_beneficiary_share.get();
        require(amount > U256::zero(), "No funds to redeem");
        config.claimed.insert(sender, true);
        config.beneficiaries.insert(sender, false);
        config.beneficiary_count.set(config.beneficiary_count.get() - U256::one());
        config.balance.set(config.balance.get() - amount);
        if config.balance.get() == U256::zero() || config.beneficiary_count.get() == U256::zero() {
            config.active.set(false);
            self.owner_count.set(self.owner_count.get() - U256::one());
        }
        let success = evm::transfer_eth(sender, amount);
        if !success {
            // Revert state changes
            config.claimed.insert(sender, false);
            config.beneficiaries.insert(sender, true);
            config.beneficiary_count.set(config.beneficiary_count.get() + U256::one());
            config.balance.set(config.balance.get() + amount);
            if !config.active.get() {
                config.active.set(true);
                self.owner_count.set(self.owner_count.get() + U256::one());
            }
            self.locked.set(false);
            panic!("Transfer failed");
        }
        // Emit FundsClaimed event
        self.locked.set(false);
    }

    // Withdraw all funds (only owner can call before expiration)
    fn withdraw_all(&mut self) {
        require(!self.locked.get(), "Reentrancy guard");
        self.locked.set(true);
        let owner = msg::sender();
        require(self.owner_exists(owner), "No inheritance plan found");
        let config = self.owners.get(owner);
        require(!config.share_locked.get(), "Plan has expired, cannot withdraw");
        let amount = config.balance.get();
        require(amount > U256::zero(), "No funds to withdraw");
        config.balance.set(U256::zero());
        config.active.set(false);
        self.owner_count.set(self.owner_count.get() - U256::one());
        let success = evm::transfer_eth(owner, amount);
        if !success {
            // Restore state
            config.balance.set(amount);
            config.active.set(true);
            self.owner_count.set(self.owner_count.get() + U256::one());
            self.locked.set(false);
            panic!("Transfer failed");
        }
        // Emit FundsWithdrawn event
        self.locked.set(false);
    }

    // Withdraw the protocol's share (only protocol admin)
    fn withdraw_protocol_share(&mut self, owner: Address) {
        require(self.vm().msg_sender() == self.admin.get(), "Only admin");
        require(!self.locked.get(), "Reentrancy guard");
        self.locked.set(true);
        require(self.owner_exists(owner), "Owner does not exist");
        let mut config = self.owners.get(owner);
        require(config.share_locked.get(), "Share not locked");
        let amount = config.protocol_share.get();
        require(amount > U256::from(0), "No protocol share to withdraw");
        let mut config = self.owners.get(owner);
        config.protocol_share.set(U256::from(0));
        let success = self.vm().transfer_eth(self.admin.get(), amount);
        match success {
                Ok(_) => {},
                Err(_) => {
                    // Restore state
                    config.protocol_share.set(amount);
                    self.locked.set(false);
                    panic!("Transfer failed");
                }    
        }
        // Emit ProtocolShareWithdrawn event
        self.locked.set(false);
    }

    // Get plan details
    fn get_plan_details(&self, owner: Address) -> (U256, U256, U256, U256, U256, bool, U256) {
        require(self.owner_exists(owner), "Owner does not exist");
        let config = self.owners.get(owner);
        (
            config.balance.get(),
            config.beneficiary_count.get(),
            config.last_reset.get(),
            config.timeout_period.get(),
            config.per_beneficiary_share.get(),
            config.share_locked.get(),
            config.protocol_share.get(),
        )
    }

    // Check if a specific owner's plan is expired
    fn is_owner_expired(&self, owner: Address) -> bool {
        require(self.owner_exists(owner), "Owner does not exist");
        let config = self.owners.get(owner);
        U256::from(self.vm().block_timestamp()) >= config.last_reset.get() + config.timeout_period.get()
    }

    // Check if an address is a beneficiary of a specific owner
    fn is_beneficiary(&self, owner: Address, beneficiary: Address) -> bool {
        require(self.owner_exists(owner), "Owner does not exist");
        self.owners.get(owner).beneficiaries.get(beneficiary)
    }

    // Check if a beneficiary has claimed their share
    fn has_claimed(&self, owner: Address, beneficiary: Address) -> bool {
        require(self.owner_exists(owner), "Owner does not exist");
        self.owners.get(owner).claimed.get(beneficiary)
    }

    // Helper function to check if an owner exists
    fn owner_exists(&self, owner: Address) -> bool {
        self.owners.get(owner).active.get()
    }

    // Get time remaining before a plan expires
    fn time_remaining(&self, owner: Address) -> U256 {
        require(self.owner_exists(owner), "Owner does not exist");
        let config = self.owners.get(owner);
        let expiry_time = config.last_reset.get() + config.timeout_period.get();
        let current_time = U256::from(self.vm().block_timestamp());
        if current_time >= expiry_time {
            U256::zero()
        } else {
            expiry_time - current_time
        }
    }

    // Get all beneficiaries for a specific owner (inefficient)
    fn get_all_beneficiaries(&self, owner: Address) -> Vec<Address> {
        require(self.owner_exists(owner), "Owner does not exist");
        let config = self.owners.get(owner);
        let count = config.beneficiary_count.get().try_into().unwrap_or(0);
        let mut beneficiaries = Vec::new();
        for i in 0..10000 {
            let bytes: [u8; 32] = U256::from(i).to_be_bytes();
            let addr = Address::from(<[u8; 20]>::try_from(&bytes[12..]).expect("Slice conversion failed"));
            if config.beneficiaries.get(addr) {
                beneficiaries.push(addr);
                if beneficiaries.len() == count {
                    break;
                }
            }
        }
        beneficiaries
    }

    // Get total active beneficiary count for a plan
    fn get_active_beneficiary_count(&self, owner: Address) -> U256 {
        require(self.owner_exists(owner), "Owner does not exist");
        self.owners.get(owner).beneficiary_count.get()
    }

    // Get detailed information about a beneficiary's status
    fn get_beneficiary_details(&self, owner: Address, beneficiary: Address) -> (bool, bool, U256) {
        require(self.owner_exists(owner), "Owner does not exist");
        let config = self.owners.get(owner);
        let is_beneficiary = config.beneficiaries.get(beneficiary).unwrap_or(false);
        let has_claimed = config.claimed.get(beneficiary);
        let potential_share = if config.share_locked.get() {
            if is_beneficiary {
                config.per_beneficiary_share.get()
            } else {
                U256::from(0)
            }
        } else {
            if config.beneficiary_count.get() > U256::from(0) && is_beneficiary {
                (config.balance.get() / U256::from(2)) / config.beneficiary_count.get()
            } else {
                U256::from(0)
            }
        };
        (is_beneficiary, has_claimed, potential_share)
    }

    // Get extended plan details including expiry status
    fn get_extended_plan_details(&self, owner: Address) -> (U256, U256, U256, U256, bool, U256) {
        require(self.owner_exists(owner), "Owner does not exist");
        let config = self.owners.get(owner);
        let expiry_time = config.last_reset.get() + config.timeout_period.get();
        let is_expired = U256::from(self.vm().block_timestamp()) >= expiry_time;
        (
            config.balance.get(),
            config.beneficiary_count.get(),
            config.last_reset.get(),
            config.timeout_period.get(),
            is_expired,
            expiry_time,
        )
    }

    // Get statistical information about the contract
    fn get_contract_stats(&self) -> (U256, U256) {
        (self.owner_count.get(), self.vm().msg_value())
    }

    // Check if an owner's plan exists and is active
    fn check_plan_status(&self, owner: Address) -> (bool, bool) {
        let active = self.owner_exists(owner);
        let expired = if active {
            self.is_owner_expired(owner)
        } else {
            false
        };
        (active, expired)
    }

    // Get the protocol share amount for a specific owner's plan
    fn get_protocol_share(&self, owner: Address) -> (U256, bool) {
        require(self.owner_exists(owner), "Owner does not exist");
        let config = self.owners.get(owner);
        (config.protocol_share.get(), config.share_locked.get())
    }
}

// Require function for assertions
fn require(condition: bool, message: &str) {
    if !condition {
        panic!("{}", message);
    }
}