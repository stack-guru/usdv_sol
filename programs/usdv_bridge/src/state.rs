use anchor_lang::prelude::*;
use borsh::{BorshSerialize, BorshDeserialize};

#[derive(BorshSerialize, BorshDeserialize)]
pub struct BurnPayload {
    pub amount: u64,
    pub recipient: [u8; 32], // or Vec<u8>
}

#[account]
pub struct NonceAccount {
    pub nonce: u64, // u64 is safer than u8 to avoid overflow
}