use crate::error::CustomError;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct MintWusdv<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = token_mint.decimals == 6 @ CustomError::InvalidMintDecimals)]
    pub token_mint: Account<'info, Mint>,

    #[account(
        seeds = [b"mint_authority"], // use your actual seeds here
        bump
    )]
    /// CHECK: This will be verified in the handler
    pub mint_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnWusdv<'info> {
    #[account(mut)]
    pub user: Signer<'info>, // The owner of the token account (user)

    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ CustomError::InvalidTokenAccountOwner,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = token_mint.decimals == 6 @ CustomError::InvalidMintDecimals)]
    pub token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}
