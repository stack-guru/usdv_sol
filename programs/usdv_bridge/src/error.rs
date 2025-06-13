use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Unauthorized minting attempt.")]
    Unauthorized,

    #[msg("Mint has invalid decimals.")]
    InvalidMintDecimals,

    #[msg("OwnerOnly")]
    /// Only the program's owner is permitted.
    OwnerOnly,

    #[msg("InvalidForeignEmitter")]
    /// Specified foreign emitter has a bad chain ID or zero address.
    InvalidForeignEmitter,

    #[msg("InvalidWormholeConfig")]
    /// Specified Wormhole bridge data PDA is wrong.
    InvalidWormholeConfig,

    #[msg("InvalidWormholeFeeCollector")]
    /// Specified Wormhole fee collector PDA is wrong.
    InvalidWormholeFeeCollector,

    #[msg("InvalidWormholeSequence")]
    /// Specified emitter's sequence PDA is wrong.
    InvalidWormholeSequence,

    #[msg("InvalidMessage")]
    /// Deserialized message has unexpected payload type.
    InvalidMessage,

    #[msg("Public mint is disabled.")]
    PublicMintDisabled,

    #[msg("Amount too small to mint after deducting fee.")]
    AmountTooSmall,

    #[msg("Amount can't be zero.")]
    InvalidAmount,
}
