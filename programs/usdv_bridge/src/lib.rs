use anchor_lang::prelude::*;
use context::*;

pub mod context;
pub mod error;
pub mod message;
pub mod processor;
pub mod state;

declare_id!("G3Do6ZuHbZbEruQTwcwY5Vdu35JPnbLHpvaVEtviWwbR");

#[program]
pub mod usdv_bridge {
    use super::*;

    /// This instruction initializes the program config, which is meant
    /// to store data useful for other instructions. The config specifies
    /// an owner (e.g. multisig) and should be read-only for every instruction
    /// in this example. This owner will be checked for designated owner-only
    /// instructions like [`register_emitter`](register_emitter).
    ///
    /// # Arguments
    ///
    /// * `ctx` - `Initialize` context
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        processor::initialize(ctx)
    }

    /// This instruction registers a new foreign emitter (from another network)
    /// and saves the emitter information in a ForeignEmitter account. This
    /// instruction is owner-only, meaning that only the owner of the program
    /// (defined in the [Config] account) can add and update emitters.
    ///
    /// # Arguments
    ///
    /// * `ctx`     - `RegisterForeignEmitter` context
    /// * `chain`   - Wormhole Chain ID
    /// * `address` - Wormhole Emitter Address
    pub fn register_emitter(
        ctx: Context<RegisterEmitter>,
        chain: u16,
        address: [u8; 32],
    ) -> Result<()> {
        processor::register_emitter(ctx, chain, address)
    }

    pub fn send_message(ctx: Context<SendMessage>, message: Vec<u8>) -> Result<()> {
        processor::send_message(ctx, message)
    }

    pub fn receive_message(ctx: Context<ReceiveMessage>, vaa_hash: [u8; 32]) -> Result<()> {
        processor::receive_message(ctx, vaa_hash)
    }

    pub fn mint_wusdv(ctx: Context<MintWusdv>, amount: u64) -> Result<()> {
        processor::mint_wusdv(ctx, amount)
    }

    pub fn burn_wusdv(ctx: Context<BurnWusdv>, amount: u64) -> Result<()> {
        processor::burn_wusdv(ctx, amount)
    }
}
