#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String, Vec,
};

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Approved,
    Rejected,
    Executed,
}

#[contracttype]
#[derive(Clone)]
pub struct Proposal {
    pub id: u32,
    pub proposer: Address,
    pub description: String,
    pub amount: i128,
    pub recipient: String,
    pub approvals: u32,
    pub rejections: u32,
    pub status: ProposalStatus,
    pub created_at: u64,
}

#[contract]
pub struct MultisigContract;

#[contractimpl]
impl MultisigContract {
    /// Initialize with a list of signers and an approval threshold.
    pub fn init(env: Env, signers: Vec<Address>, threshold: u32) {
        if env.storage().instance().has(&symbol_short!("signers")) {
            panic!("already initialized");
        }
        if threshold == 0 || threshold > signers.len() {
            panic!("invalid threshold");
        }
        env.storage().instance().set(&symbol_short!("signers"), &signers);
        env.storage().instance().set(&symbol_short!("thresh"), &threshold);
    }

    /// Submit a disbursement proposal. Returns proposal id.
    pub fn propose(
        env: Env,
        proposer: Address,
        description: String,
        amount: i128,
        recipient: String,
    ) -> u32 {
        proposer.require_auth();
        Self::assert_signer(&env, &proposer);

        let mut proposals: Vec<Proposal> = env
            .storage()
            .instance()
            .get(&symbol_short!("props"))
            .unwrap_or(Vec::new(&env));

        let id = proposals.len();
        proposals.push_back(Proposal {
            id,
            proposer,
            description,
            amount,
            recipient,
            approvals: 0,
            rejections: 0,
            status: ProposalStatus::Pending,
            created_at: env.ledger().timestamp(),
        });
        env.storage().instance().set(&symbol_short!("props"), &proposals);
        id
    }

    /// Cast a vote on a proposal.
    pub fn vote(env: Env, signer: Address, proposal_id: u32, approve: bool) {
        signer.require_auth();
        Self::assert_signer(&env, &signer);

        let mut proposals: Vec<Proposal> = env
            .storage()
            .instance()
            .get(&symbol_short!("props"))
            .expect("no proposals");

        let mut p = proposals.get(proposal_id).expect("invalid id");
        if p.status != ProposalStatus::Pending {
            panic!("proposal not pending");
        }

        if approve {
            p.approvals += 1;
        } else {
            p.rejections += 1;
        }

        let threshold: u32 = env
            .storage()
            .instance()
            .get(&symbol_short!("thresh"))
            .expect("not initialized");

        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&symbol_short!("signers"))
            .expect("not initialized");

        if p.approvals >= threshold {
            p.status = ProposalStatus::Approved;
        } else if p.rejections > signers.len() - threshold {
            p.status = ProposalStatus::Rejected;
        }

        proposals.set(proposal_id, p);
        env.storage().instance().set(&symbol_short!("props"), &proposals);
    }

    /// Mark an approved proposal as executed (admin action after off-chain settlement).
    pub fn execute(env: Env, signer: Address, proposal_id: u32) {
        signer.require_auth();
        Self::assert_signer(&env, &signer);

        let mut proposals: Vec<Proposal> = env
            .storage()
            .instance()
            .get(&symbol_short!("props"))
            .expect("no proposals");

        let mut p = proposals.get(proposal_id).expect("invalid id");
        if p.status != ProposalStatus::Approved {
            panic!("proposal not approved");
        }
        p.status = ProposalStatus::Executed;
        proposals.set(proposal_id, p);
        env.storage().instance().set(&symbol_short!("props"), &proposals);
    }

    pub fn get_proposal(env: Env, proposal_id: u32) -> Proposal {
        let proposals: Vec<Proposal> = env
            .storage()
            .instance()
            .get(&symbol_short!("props"))
            .expect("no proposals");
        proposals.get(proposal_id).expect("invalid id")
    }

    pub fn proposal_count(env: Env) -> u32 {
        let proposals: Vec<Proposal> = env
            .storage()
            .instance()
            .get(&symbol_short!("props"))
            .unwrap_or(Vec::new(&env));
        proposals.len()
    }

    fn assert_signer(env: &Env, addr: &Address) {
        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&symbol_short!("signers"))
            .expect("not initialized");
        let mut found = false;
        for s in signers.iter() {
            if &s == addr {
                found = true;
                break;
            }
        }
        if !found {
            panic!("not a signer");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Ledger, vec, Env, String};

    fn setup() -> (Env, soroban_sdk::Address, soroban_sdk::Address, soroban_sdk::Address, MultisigContractClient<'static>) {
        let env = Env::default();
        env.ledger().set_timestamp(0);
        let contract_id = env.register_contract(None, MultisigContract);
        let client = MultisigContractClient::new(&env, &contract_id);
        let s1 = soroban_sdk::Address::generate(&env);
        let s2 = soroban_sdk::Address::generate(&env);
        let s3 = soroban_sdk::Address::generate(&env);
        env.mock_all_auths();
        client.init(&vec![&env, s1.clone(), s2.clone(), s3.clone()], &2);
        (env, s1, s2, s3, client)
    }

    #[test]
    fn test_propose_and_approve() {
        let (_env, s1, s2, _s3, client) = setup();
        let id = client.propose(
            &s1,
            &soroban_sdk::String::from_str(&_env, "Pay vendor"),
            &10000i128,
            &soroban_sdk::String::from_str(&_env, "GADDR"),
        );
        assert_eq!(id, 0);
        client.vote(&s1, &0, &true);
        client.vote(&s2, &0, &true);
        let p = client.get_proposal(&0);
        assert_eq!(p.status, ProposalStatus::Approved);
    }
}
