use crate::context::{BurnWusdv, MintWusdv};
use crate::state::BurnPayload;
use anchor_lang::prelude::*;
use anchor_spl::token::{burn, mint_to, Burn, MintTo};
use wormhole_anchor_sdk::wormhole::*;

pub fn mint_wusdv(ctx: Context<MintWusdv>, amount: u64) -> Result<()> {
    // Ensure the mint authority is the bridge program
    // let mint_authority = &ctx.accounts.mint_authority;
    let seeds: &[&[u8]] = &[b"mint_authority", &[ctx.bumps.mint_authority]];

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.token_mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.clone(),
        },
    );

    mint_to(cpi_ctx.with_signer(&[seeds]), amount)?;

    msg!("Successfully minted {} wUSDV", amount);
    Ok(())
}

pub fn burn_wusdv(ctx: Context<BurnWusdv>, amount: u64, recipient: Pubkey) -> Result<()> {
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.token_mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(), // now signer is authority
        },
    );

    burn(cpi_ctx, amount)?;

    msg!("Successfully burned {} wUSDV", amount);

    // Convert recipient Pubkey to padded 32-byte array (if targeting EVM)
    let mut recipient_address = [0u8; 32];
    recipient_address[12..].copy_from_slice(&recipient.to_bytes()[..20]);

    let payload = BurnPayload { amount, recipient: recipient_address };

    let payload_bytes = payload.try_to_vec()?; // serialize to Vec<u8>

    // Wormhole post_message call
    post_message(
        CpiContext::new_with_signer(
            ctx.accounts.wormhole_program.to_account_info(),
            PostMessage {
                config: ctx.accounts.wormhole_config.clone(),
                message: ctx.accounts.wormhole_message.clone(),
                emitter: ctx.accounts.wormhole_emitter.clone(),
                sequence: ctx.accounts.wormhole_sequence.clone(),
                payer: ctx.accounts.wormhole_payer.to_account_info(),
                fee_collector: ctx.accounts.wormhole_fee_collector.clone(),
                clock: ctx.accounts.clock.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
            &[&[b"emitter", &[ctx.bumps.wormhole_emitter]]], // example signer seed
        ),
        0,                   // batch_id
        payload_bytes,             // serialized payload
        Finality::Confirmed, // finality level
    )?;

    Ok(())
}
