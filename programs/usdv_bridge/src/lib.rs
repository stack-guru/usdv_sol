use anchor_lang::prelude::*;

declare_id!("EjqTB7zPPHb26icpdv1Si1uYzE7WpNweRe4XyeXphC2Z");

#[program]
pub mod usdv_bridge {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
