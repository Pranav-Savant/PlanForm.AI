#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, String, Symbol, Vec,
};

// Storage keys (max 9 chars for symbol_short!)
const BLUEPRINTS: Symbol = symbol_short!("BPRINTS");
const COUNTER: Symbol = symbol_short!("COUNTER");

/// Blueprint data structure stored on-chain
/// Represents a floor plan analysis result from PlanForm.AI
#[derive(Clone, Debug)]
#[contracttype]
pub struct Blueprint {
    pub id: u64,
    pub project_name: String,
    pub owner: Address,
    pub cost_estimate: i128,      // Total construction cost in smallest unit
    pub material_hash: String,    // SHA256 hash of materials JSON
    pub rooms_count: u32,         // Number of rooms detected
    pub total_area_sqft: u32,     // Total area in square feet
    pub timestamp: u64,           // Unix timestamp of registration
    pub is_verified: bool,        // Whether blueprint has been verified
}

/// Simplified blueprint info for listing
#[derive(Clone, Debug)]
#[contracttype]
pub struct BlueprintInfo {
    pub id: u64,
    pub project_name: String,
    pub cost_estimate: i128,
    pub timestamp: u64,
}

#[contract]
pub struct BlueprintRegistryContract;

#[contractimpl]
impl BlueprintRegistryContract {
    /// Initialize the contract
    pub fn initialize(env: Env) {
        env.storage().instance().set(&COUNTER, &0u64);
    }

    /// Register a new blueprint on the blockchain
    /// Called after AI analysis completes to store results immutably
    /// 
    /// # Arguments
    /// * `project_name` - Name of the floor plan project
    /// * `owner` - Wallet address of the user
    /// * `cost_estimate` - Total estimated construction cost
    /// * `material_hash` - SHA256 hash of materials recommendation JSON
    /// * `rooms_count` - Number of rooms detected in floor plan
    /// * `total_area_sqft` - Total area in square feet
    /// 
    /// # Returns
    /// * `u64` - The unique blueprint ID
    pub fn register_blueprint(
        env: Env,
        project_name: String,
        owner: Address,
        cost_estimate: i128,
        material_hash: String,
        rooms_count: u32,
        total_area_sqft: u32,
    ) -> u64 {
        // Require authorization from the owner
        owner.require_auth();

        // Get and increment counter
        let mut counter: u64 = env.storage().instance().get(&COUNTER).unwrap_or(0);
        counter += 1;
        env.storage().instance().set(&COUNTER, &counter);

        // Create blueprint struct
        let blueprint = Blueprint {
            id: counter,
            project_name: project_name.clone(),
            owner: owner.clone(),
            cost_estimate,
            material_hash,
            rooms_count,
            total_area_sqft,
            timestamp: env.ledger().timestamp(),
            is_verified: false,
        };

        // Store blueprint with its ID as key
        let key = Self::blueprint_key(counter);
        env.storage().persistent().set(&key, &blueprint);

        // Store in user's blueprint list
        Self::add_to_user_blueprints(&env, &owner, counter);

        // Emit event for frontend tracking
        env.events().publish(
            (symbol_short!("register"), owner),
            (counter, project_name, cost_estimate),
        );

        counter
    }

    /// Retrieve a blueprint by its ID
    /// 
    /// # Arguments
    /// * `blueprint_id` - The unique ID of the blueprint
    /// 
    /// # Returns
    /// * `Blueprint` - The full blueprint data
    pub fn get_blueprint(env: Env, blueprint_id: u64) -> Blueprint {
        let key = Self::blueprint_key(blueprint_id);
        env.storage()
            .persistent()
            .get(&key)
            .expect("Blueprint not found")
    }

    /// Get all blueprints owned by a specific address
    /// 
    /// # Arguments
    /// * `owner` - The wallet address to query
    /// 
    /// # Returns
    /// * `Vec<BlueprintInfo>` - List of blueprint summaries
    pub fn get_user_blueprints(env: Env, owner: Address) -> Vec<BlueprintInfo> {
        let user_key = Self::user_blueprints_key(&owner);
        let blueprint_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&user_key)
            .unwrap_or(vec![&env]);

        let mut infos: Vec<BlueprintInfo> = vec![&env];
        
        for id in blueprint_ids.iter() {
            let key = Self::blueprint_key(id);
            if let Some(bp) = env.storage().persistent().get::<_, Blueprint>(&key) {
                infos.push_back(BlueprintInfo {
                    id: bp.id,
                    project_name: bp.project_name,
                    cost_estimate: bp.cost_estimate,
                    timestamp: bp.timestamp,
                });
            }
        }

        infos
    }

    /// Update the cost estimate for a blueprint (owner only)
    /// 
    /// # Arguments
    /// * `blueprint_id` - The blueprint to update
    /// * `owner` - Must be the blueprint owner
    /// * `new_cost_estimate` - The updated cost estimate
    pub fn update_cost_estimate(
        env: Env,
        blueprint_id: u64,
        owner: Address,
        new_cost_estimate: i128,
    ) {
        owner.require_auth();

        let key = Self::blueprint_key(blueprint_id);
        let mut blueprint: Blueprint = env
            .storage()
            .persistent()
            .get(&key)
            .expect("Blueprint not found");

        // Verify ownership
        if blueprint.owner != owner {
            panic!("Only the owner can update this blueprint");
        }

        blueprint.cost_estimate = new_cost_estimate;
        env.storage().persistent().set(&key, &blueprint);

        env.events().publish(
            (symbol_short!("update"), owner),
            (blueprint_id, new_cost_estimate),
        );
    }

    /// Verify a blueprint (can be called by anyone to mark as reviewed)
    pub fn verify_blueprint(env: Env, blueprint_id: u64, verifier: Address) {
        verifier.require_auth();

        let key = Self::blueprint_key(blueprint_id);
        let mut blueprint: Blueprint = env
            .storage()
            .persistent()
            .get(&key)
            .expect("Blueprint not found");

        blueprint.is_verified = true;
        env.storage().persistent().set(&key, &blueprint);

        env.events().publish(
            (symbol_short!("verify"), verifier),
            blueprint_id,
        );
    }

    /// Get total number of blueprints registered
    pub fn get_blueprint_count(env: Env) -> u64 {
        env.storage().instance().get(&COUNTER).unwrap_or(0)
    }

    // Helper: Generate storage key for blueprint
    fn blueprint_key(id: u64) -> (Symbol, u64) {
        (BLUEPRINTS, id)
    }

    // Helper: Generate storage key for user's blueprint list
    fn user_blueprints_key(owner: &Address) -> (Symbol, Address) {
        (symbol_short!("USER_BP"), owner.clone())
    }

    // Helper: Add blueprint ID to user's list
    fn add_to_user_blueprints(env: &Env, owner: &Address, blueprint_id: u64) {
        let user_key = Self::user_blueprints_key(owner);
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&user_key)
            .unwrap_or(vec![env]);
        
        ids.push_back(blueprint_id);
        env.storage().persistent().set(&user_key, &ids);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_register_and_get_blueprint() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register(BlueprintRegistryContract, ());
        let client = BlueprintRegistryContractClient::new(&env, &contract_id);

        // Initialize
        client.initialize();

        let owner = Address::generate(&env);
        let project_name = String::from_str(&env, "Test Floor Plan");
        let material_hash = String::from_str(&env, "abc123hash");

        // Set timestamp
        env.ledger().set_timestamp(1700000000);

        // Register blueprint
        let id = client.register_blueprint(
            &project_name,
            &owner,
            &1000000_i128,
            &material_hash,
            &5_u32,
            &2000_u32,
        );

        assert_eq!(id, 1);

        // Retrieve blueprint
        let blueprint = client.get_blueprint(&id);
        assert_eq!(blueprint.project_name, project_name);
        assert_eq!(blueprint.cost_estimate, 1000000_i128);
        assert_eq!(blueprint.rooms_count, 5);
        assert_eq!(blueprint.total_area_sqft, 2000);
        assert_eq!(blueprint.is_verified, false);
    }

    #[test]
    fn test_user_blueprints() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register(BlueprintRegistryContract, ());
        let client = BlueprintRegistryContractClient::new(&env, &contract_id);

        client.initialize();

        let owner = Address::generate(&env);

        // Register multiple blueprints
        client.register_blueprint(
            &String::from_str(&env, "Plan A"),
            &owner,
            &500000_i128,
            &String::from_str(&env, "hash1"),
            &3_u32,
            &1500_u32,
        );

        client.register_blueprint(
            &String::from_str(&env, "Plan B"),
            &owner,
            &750000_i128,
            &String::from_str(&env, "hash2"),
            &4_u32,
            &1800_u32,
        );

        let user_blueprints = client.get_user_blueprints(&owner);
        assert_eq!(user_blueprints.len(), 2);
    }

    #[test]
    fn test_update_cost_estimate() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register(BlueprintRegistryContract, ());
        let client = BlueprintRegistryContractClient::new(&env, &contract_id);

        client.initialize();

        let owner = Address::generate(&env);

        let id = client.register_blueprint(
            &String::from_str(&env, "Test Plan"),
            &owner,
            &1000000_i128,
            &String::from_str(&env, "hash"),
            &5_u32,
            &2000_u32,
        );

        // Update cost
        client.update_cost_estimate(&id, &owner, &1200000_i128);

        let blueprint = client.get_blueprint(&id);
        assert_eq!(blueprint.cost_estimate, 1200000_i128);
    }
}
