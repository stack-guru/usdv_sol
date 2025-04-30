use anchor_lang::prelude::*;
use borsh::{BorshSerialize, BorshDeserialize};

#[error_code]
pub enum CustomError {
    #[msg("Unauthorized minting attempt.")]
    Unauthorized,

    #[msg("Mint has invalid decimals.")]
    InvalidMintDecimals,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct BurnPayload {
    pub amount: u64,
    pub recipient: [u8; 32], // or Vec<u8>
}