use crate::{
    context::{BurnWusdv, MintWusdv},
    state::CustomError,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{mint_to, MintTo, Burn, burn};

pub fn mint_wusdv(ctx: Context<MintWusdv>, amount: u64) -> Result<()> {
    // Ensure the mint authority is the bridge program
    let mint_authority = &ctx.accounts.mint_authority;
    require!(
        mint_authority.key() == *ctx.program_id,
        CustomError::Unauthorized
    );

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.token_mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.clone(),
        },
    );

    mint_to(cpi_ctx, amount)?;

    msg!("Successfully minted {} wUSDV", amount);
    Ok(())
}

pub fn burn_wusdv(ctx: Context<BurnWusdv>, amount: u64) -> Result<()> {
    // Ensure the burn authority is the bridge program
    let burn_authority = &ctx.accounts.burn_authority;
    require!(
        burn_authority.key() == *ctx.program_id,
        CustomError::Unauthorized
    );

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.token_mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.burn_authority.clone(),
        },
    );

    burn(cpi_ctx, amount)?;

    msg!("Successfully burned {} wUSDV", amount);
    Ok(())
}
