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
#[instruction(nonce: u8)]
pub struct BurnWusdv<'info> {
    #[account(mut)]
    pub user: Signer<'info>, // signer, but not checking token account owner

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>, // token account to burn from

    #[account(mut, constraint = token_mint.decimals == 6 @ CustomError::InvalidMintDecimals)]
    pub token_mint: Account<'info, Mint>, // the token mint

    pub token_program: Program<'info, Token>,

    // ✅ Wormhole required accounts
    /// CHECK: verified via CPI
    pub wormhole_program: AccountInfo<'info>,

    /// CHECK: Wormhole config account (get from the Wormhole docs / IDL)
    pub wormhole_config: AccountInfo<'info>,

    /// CHECK: This is a Wormhole message account initialized in this instruction; its validity is ensured by the program logic.
    #[account(
        init,
        payer = wormhole_payer,
        space = 1000, // or VAA_MAX_SIZE, typically ~1000
        seeds = [b"message", user.key().as_ref(), &[nonce]], // Optional nonce or similar seed
        bump
    )]
    pub wormhole_message: AccountInfo<'info>,

    /// CHECK: Must be a PDA from your program (emitter)
    #[account(seeds = [b"emitter"], bump)]
    pub wormhole_emitter: AccountInfo<'info>,

    /// CHECK: Tracks message sequence
    #[account(mut)]
    pub wormhole_sequence: AccountInfo<'info>,

    #[account(mut)]
    pub wormhole_payer: Signer<'info>,

    /// CHECK: Wormhole fee collector (use address from Wormhole docs)
    #[account(mut)]
    pub wormhole_fee_collector: AccountInfo<'info>,

    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}
