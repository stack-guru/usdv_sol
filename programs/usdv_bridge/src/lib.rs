use anchor_lang::prelude::*;
use context::*;
use processor::{mint_wusdv, burn_wusdv};

pub mod error;
pub mod state;
pub mod context;
pub mod processor;

declare_id!("EjqTB7zPPHb26icpdv1Si1uYzE7WpNweRe4XyeXphC2Z");

#[program]
pub mod usdv_bridge {
    use super::*;

    pub fn mint_wusdv(ctx: Context<MintWusdv>, amount: u64) -> Result<()> {
        processor::mint_wusdv(ctx, amount)
    }

    pub fn burn_wusdv(ctx: Context<BurnWusdv>, amount: u64) -> Result<()> {
        processor::burn_wusdv(ctx, amount)
    }
}
