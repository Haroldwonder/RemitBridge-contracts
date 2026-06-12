#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct PayrollEntry {
    pub org_id: u64,
    pub recipient: String,
    pub amount: i128,
    pub currency: String,
    pub interval_secs: u64,
    pub next_payout: u64,
    pub active: bool,
}

#[contract]
pub struct PayrollContract;

#[contractimpl]
impl PayrollContract {
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&symbol_short!("admin")) {
            panic!("already initialized");
        }
        env.storage().instance().set(&symbol_short!("admin"), &admin);
    }

    /// Schedule a recurring payroll entry. Returns entry index.
    pub fn schedule(
        env: Env,
        caller: Address,
        org_id: u64,
        recipient: String,
        amount: i128,
        currency: String,
        interval_secs: u64,
    ) -> u32 {
        caller.require_auth();
        Self::assert_admin(&env, &caller);

        let mut entries: Vec<PayrollEntry> = env
            .storage()
            .instance()
            .get(&symbol_short!("entries"))
            .unwrap_or(Vec::new(&env));

        let entry = PayrollEntry {
            org_id,
            recipient,
            amount,
            currency,
            interval_secs,
            next_payout: env.ledger().timestamp() + interval_secs,
            active: true,
        };
        entries.push_back(entry);
        let idx = entries.len() - 1;
        env.storage().instance().set(&symbol_short!("entries"), &entries);
        idx
    }

    /// Cancel a payroll entry (admin only).
    pub fn cancel(env: Env, caller: Address, index: u32) {
        caller.require_auth();
        Self::assert_admin(&env, &caller);

        let mut entries: Vec<PayrollEntry> = env
            .storage()
            .instance()
            .get(&symbol_short!("entries"))
            .expect("no entries");

        let mut entry = entries.get(index).expect("invalid index");
        entry.active = false;
        entries.set(index, entry);
        env.storage().instance().set(&symbol_short!("entries"), &entries);
    }

    /// Mark an entry as paid and advance the next_payout timestamp.
    pub fn mark_paid(env: Env, caller: Address, index: u32) {
        caller.require_auth();
        Self::assert_admin(&env, &caller);

        let mut entries: Vec<PayrollEntry> = env
            .storage()
            .instance()
            .get(&symbol_short!("entries"))
            .expect("no entries");

        let mut entry = entries.get(index).expect("invalid index");
        if !entry.active {
            panic!("entry inactive");
        }
        let now = env.ledger().timestamp();
        if now < entry.next_payout {
            panic!("payout not due yet");
        }
        entry.next_payout = now + entry.interval_secs;
        entries.set(index, entry);
        env.storage().instance().set(&symbol_short!("entries"), &entries);
    }

    pub fn get_entry(env: Env, index: u32) -> PayrollEntry {
        let entries: Vec<PayrollEntry> = env
            .storage()
            .instance()
            .get(&symbol_short!("entries"))
            .expect("no entries");
        entries.get(index).expect("invalid index")
    }

    pub fn entry_count(env: Env) -> u32 {
        let entries: Vec<PayrollEntry> = env
            .storage()
            .instance()
            .get(&symbol_short!("entries"))
            .unwrap_or(Vec::new(&env));
        entries.len()
    }

    fn assert_admin(env: &Env, caller: &Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("admin"))
            .expect("not initialized");
        if caller != &admin {
            panic!("unauthorized");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Ledger, Env, String};

    #[test]
    fn test_schedule_and_get() {
        let env = Env::default();
        env.ledger().set_timestamp(0);
        let contract_id = env.register_contract(None, PayrollContract);
        let client = PayrollContractClient::new(&env, &contract_id);

        let admin = soroban_sdk::Address::generate(&env);
        env.mock_all_auths();
        client.init(&admin);

        let idx = client.schedule(
            &admin,
            &1u64,
            &String::from_str(&env, "GADDR"),
            &5000i128,
            &String::from_str(&env, "USDC"),
            &2592000u64, // 30 days
        );
        assert_eq!(idx, 0);
        let entry = client.get_entry(&0);
        assert!(entry.active);
        assert_eq!(entry.next_payout, 2592000);
    }

    #[test]
    fn test_mark_paid_advances_schedule() {
        let env = Env::default();
        env.ledger().set_timestamp(0);
        let contract_id = env.register_contract(None, PayrollContract);
        let client = PayrollContractClient::new(&env, &contract_id);

        let admin = soroban_sdk::Address::generate(&env);
        env.mock_all_auths();
        client.init(&admin);
        client.schedule(
            &admin,
            &1u64,
            &String::from_str(&env, "GADDR"),
            &1000i128,
            &String::from_str(&env, "USDC"),
            &86400u64,
        );

        env.ledger().set_timestamp(86401);
        client.mark_paid(&admin, &0);
        let entry = client.get_entry(&0);
        assert_eq!(entry.next_payout, 86401 + 86400);
    }
}
