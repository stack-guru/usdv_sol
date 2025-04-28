use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Unauthorized minting attempt.")]
    Unauthorized,

    #[msg("Mint has invalid decimals.")]
    InvalidMintDecimals,

    #[msg("The owner of the token account does not match the provided user.")]
    InvalidTokenAccountOwner,
}
