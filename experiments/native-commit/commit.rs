//! Unexecuted characterization of the pinned database boundary, not an EVM test.
use revm_database::{AccountState, CacheDB, Database, DatabaseCommit, EmptyDB};
use revm_database::primitives::{Address, U256};
use revm_state::Account;

fn absent() -> Account { Account::new_not_existing(Default::default()) }
fn apply(account: Account) -> CacheDB<EmptyDB> {
    let mut db = CacheDB::new(EmptyDB::default());
    db.commit([(Address::with_last_byte(1), account)].into_iter().collect());
    db
}

#[test]
fn untouched_absent_account_stays_absent() {
    let mut db = apply(absent());
    assert!(db.basic(Address::with_last_byte(1)).unwrap().is_none());
}

#[test]
fn touched_empty_account_is_retained_by_this_version() {
    let mut account = absent();
    account.mark_touch();
    assert!(account.is_empty());
    assert!(!account.is_selfdestructed());
    assert!(!account.is_created());
    let mut db = apply(account);
    let info = db.basic(Address::with_last_byte(1)).unwrap().unwrap();
    assert!(info.is_empty());
    assert_eq!(db.cache.accounts[&Address::with_last_byte(1)].account_state, AccountState::Touched);
}

#[test]
fn selfdestructed_account_is_removed() {
    let mut account = absent();
    account.mark_touch();
    account.mark_selfdestruct();
    let mut db = apply(account);
    assert!(db.basic(Address::with_last_byte(1)).unwrap().is_none());
}

#[test]
fn touched_nonempty_account_keeps_its_balance() {
    let mut account = absent();
    account.mark_touch();
    account.info.balance = U256::from(1);
    let mut db = apply(account);
    assert_eq!(db.basic(Address::with_last_byte(1)).unwrap().unwrap().balance, U256::from(1));
}

#[test]
#[ignore = "separate desired-cleanup oracle; expected to fail on pinned source, not yet run"]
fn desired_touched_empty_cleanup() {
    let mut account = absent();
    account.mark_touch();
    let mut db = apply(account);
    assert!(db.basic(Address::with_last_byte(1)).unwrap().is_none());
}
