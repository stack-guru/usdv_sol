use crate::state::received::MESSAGE_MAX_LENGTH;
use crate::BURN_AMOUNT;
use crate::{
    context::{
        BurnAndSendMessage, Initialize, ReceiveAndMint, RegisterEmitter, SetPublicMint,
        SEED_PREFIX_SENT,
    },
    error::CustomError,
    message::WormholeMessage,
};
use anchor_lang::prelude::*;
use anchor_lang::solana_program;
// use anchor_spl::token::{burn, mint_to, Burn, MintTo};
use anchor_spl::token_interface::{burn, mint_to, Burn, MintTo};
use wormhole_anchor_sdk::wormhole;

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let config = &mut ctx.accounts.config;

    // Set the owner of the config (effectively the owner of the program).
    config.owner = ctx.accounts.owner.key();
    config.is_public_mint = false;

    // Set Wormhole related addresses.
    {
        let wormhole = &mut config.wormhole;

        // wormhole::BridgeData (Wormhole's program data).
        wormhole.bridge = ctx.accounts.wormhole_bridge.key();

        // wormhole::FeeCollector (lamports collector for posting
        // messages).
        wormhole.fee_collector = ctx.accounts.wormhole_fee_collector.key();

        // wormhole::SequenceTracker (tracks # of messages posted by this
        // program).
        wormhole.sequence = ctx.accounts.wormhole_sequence.key();
    }

    // Set default values for posting Wormhole messages.
    //
    // Zero means no batching.
    config.batch_id = 0;

    // Anchor IDL default coder cannot handle wormhole::Finality enum,
    // so this value is stored as u8.
    config.finality = wormhole::Finality::Confirmed as u8;

    // Initialize our Wormhole emitter account. It is not required by the
    // Wormhole program that there is an actual account associated with the
    // emitter PDA. The emitter PDA is just a mechanism to have the program
    // sign for the `wormhole::post_message` instruction.
    //
    // But for fun, we will store our emitter's bump for convenience.
    ctx.accounts.wormhole_emitter.bump = ctx.bumps.wormhole_emitter;

    // This scope shows the steps of how to post a message with the
    // Wormhole program.
    {
        // If Wormhole requires a fee before posting a message, we need to
        // transfer lamports to the fee collector. Otherwise
        // `wormhole::post_message` will fail.
        let fee = ctx.accounts.wormhole_bridge.fee();
        if fee > 0 {
            solana_program::program::invoke(
                &solana_program::system_instruction::transfer(
                    &ctx.accounts.owner.key(),
                    &ctx.accounts.wormhole_fee_collector.key(),
                    fee,
                ),
                &ctx.accounts.to_account_infos(),
            )?;
        }

        // Invoke `wormhole::post_message`. We are sending a Wormhole
        // message in the `initialize` instruction so the Wormhole program
        // can create a SequenceTracker account for our emitter. We will
        // deserialize this account for our `send_message` instruction so
        // we can find the next sequence number. More details about this in
        // `send_message`.
        //
        // `wormhole::post_message` requires two signers: one for the
        // emitter and another for the wormhole message data. Both of these
        // accounts are owned by this program.
        //
        // There are two ways to handle the wormhole message data account:
        //   1. Using an extra keypair. You may to generate a keypair
        //      outside of this instruction and pass that keypair as an
        //      additional signer for the transaction. An integrator might
        //      use an extra keypair if the message can be "thrown away"
        //      (not easily retrievable without going back to this
        //      transaction hash to retrieve the message's pubkey).
        //   2. Generate a PDA. If we want some way to deserialize the
        //      message data written by the Wormhole program, we can use an
        //      account with an address derived by this program so we can
        //      use the PDA to access and deserialize the message data.
        //
        // In our example, we use method #2.
        let wormhole_emitter = &ctx.accounts.wormhole_emitter;
        let config = &ctx.accounts.config;

        // If anyone were to care about the first message this program
        // emits, he can deserialize it to find the program with which
        // the emitter PDA was derived.
        let mut payload: Vec<u8> = Vec::new();
        WormholeMessage::serialize(
            &WormholeMessage::Alive {
                program_id: *ctx.program_id,
            },
            &mut payload,
        )?;

        wormhole::post_message(
            CpiContext::new_with_signer(
                ctx.accounts.wormhole_program.to_account_info(),
                wormhole::PostMessage {
                    config: ctx.accounts.wormhole_bridge.to_account_info(),
                    message: ctx.accounts.wormhole_message.to_account_info(),
                    emitter: wormhole_emitter.to_account_info(),
                    sequence: ctx.accounts.wormhole_sequence.to_account_info(),
                    payer: ctx.accounts.owner.to_account_info(),
                    fee_collector: ctx.accounts.wormhole_fee_collector.to_account_info(),
                    clock: ctx.accounts.clock.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                },
                &[
                    &[
                        SEED_PREFIX_SENT,
                        &wormhole::INITIAL_SEQUENCE.to_le_bytes()[..],
                        &[ctx.bumps.wormhole_message],
                    ],
                    &[wormhole::SEED_PREFIX_EMITTER, &[wormhole_emitter.bump]],
                ],
            ),
            config.batch_id,
            payload,
            config.finality.try_into().unwrap(),
        )?;
    }

    // Done.
    Ok(())
}

pub fn register_emitter(
    ctx: Context<RegisterEmitter>,
    chain: u16,
    address: [u8; 32],
) -> Result<()> {
    // Foreign emitter cannot share the same Wormhole Chain ID as the
    // Solana Wormhole program's. And cannot register a zero address.
    require!(
        chain > 0 && chain != wormhole::CHAIN_ID_SOLANA && !address.iter().all(|&x| x == 0),
        CustomError::InvalidForeignEmitter,
    );

    // Save the emitter info into the ForeignEmitter account.
    let emitter = &mut ctx.accounts.foreign_emitter;
    emitter.chain = chain;
    emitter.address = address;

    // Done.
    Ok(())
}

fn vec_u8_to_u64(vec: Vec<u8>) -> Result<u64> {
    let s = std::str::from_utf8(&vec).map_err(|_| error!(CustomError::InvalidMessage))?;
    s.parse::<u64>()
        .map_err(|_| error!(CustomError::InvalidMessage))
}

pub fn receive_and_mint(ctx: Context<ReceiveAndMint>, vaa_hash: [u8; 32]) -> Result<()> {
    let posted_message = &ctx.accounts.posted;
    require!(
        ctx.accounts.config.is_public_mint,
        CustomError::PublicMintDisabled
    );

    if let WormholeMessage::Hello { message } = posted_message.data() {
        // 1. Validate message length
        require!(
            message.len() <= MESSAGE_MAX_LENGTH,
            CustomError::InvalidMessage,
        );

        let amount = vec_u8_to_u64(message.clone())?;

        // 3. Record the message to prevent replay
        let received = &mut ctx.accounts.received;
        received.batch_id = posted_message.batch_id();
        received.wormhole_message_hash = vaa_hash;
        received.message = message.clone();

        msg!("minting... {} wUSDV", amount);
        require!(amount > BURN_AMOUNT, CustomError::AmountTooSmall);
        let mint_amount = amount - BURN_AMOUNT;

        // 4. Mint the tokens using PDA
        let seeds: &[&[u8]] = &[b"mint_authority", &[ctx.bumps.mint_authority]];

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.clone(),
            },
        );

        mint_to(cpi_ctx.with_signer(&[seeds]), mint_amount)?;

        msg!("Successfully received and minted {} wUSDV", mint_amount);
        Ok(())
    } else {
        Err(CustomError::InvalidMessage.into())
    }
}

pub fn set_public_mint(ctx: Context<SetPublicMint>, is_mintable: bool) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.is_public_mint = is_mintable;
    msg!("Set is_public_mint to {}", is_mintable);
    Ok(())
}

pub fn burn_and_send(ctx: Context<BurnAndSendMessage>, amount: u64) -> Result<()> {
    require!(amount > 0, CustomError::InvalidAmount);

    let burn_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.token_mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );

    burn(burn_ctx, amount + BURN_AMOUNT)?;
    msg!("Successfully burned {} wUSDV", amount + BURN_AMOUNT);

    // Convert `amount` to message payload
    let payload: Vec<u8> = WormholeMessage::Hello {
        message: amount.to_string().into_bytes(),
    }
    .try_to_vec()?;

    let fee = ctx.accounts.wormhole_bridge.fee();
    if fee > 0 {
        solana_program::program::invoke(
            &solana_program::system_instruction::transfer(
                &ctx.accounts.payer.key(),
                &ctx.accounts.wormhole_fee_collector.key(),
                fee,
            ),
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.wormhole_fee_collector.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    let wormhole_emitter = &ctx.accounts.wormhole_emitter;
    let config = &ctx.accounts.config;

    msg!("Posting message...");
    wormhole::post_message(
        CpiContext::new_with_signer(
            ctx.accounts.wormhole_program.to_account_info(),
            wormhole::PostMessage {
                config: ctx.accounts.wormhole_bridge.to_account_info(),
                message: ctx.accounts.wormhole_message.to_account_info(),
                emitter: wormhole_emitter.to_account_info(),
                sequence: ctx.accounts.wormhole_sequence.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                fee_collector: ctx.accounts.wormhole_fee_collector.to_account_info(),
                clock: ctx.accounts.clock.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
            &[
                &[
                    SEED_PREFIX_SENT,
                    &ctx.accounts.wormhole_sequence.next_value().to_le_bytes()[..],
                    &[ctx.bumps.wormhole_message],
                ],
                &[wormhole::SEED_PREFIX_EMITTER, &[wormhole_emitter.bump]],
            ],
        ),
        config.batch_id,
        payload,
        config.finality.try_into().unwrap(),
    )?;

    Ok(())
}

/*
pub fn mint_wusdv(ctx: Context<MintWusdv>, amount: u64) -> Result<()> {
    // Ensure the mint authority is the bridge program
    // let mint_authority = &ctx.accounts.mint_authority;
    require!(amount > BURN_AMOUNT, CustomError::AmountTooSmall);

    let seeds: &[&[u8]] = &[b"mint_authority", &[ctx.bumps.mint_authority]];
    let mint_amount = amount - BURN_AMOUNT;

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.token_mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.clone(),
        },
    );

    mint_to(cpi_ctx.with_signer(&[seeds]), mint_amount)?;

    msg!("Successfully minted {} wUSDV", mint_amount);
    Ok(())
}

pub fn burn_wusdv(ctx: Context<BurnWusdv>, amount: u64) -> Result<()> {
    require!(amount > 0, CustomError::InvalidAmount);

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.token_mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(), // now signer is authority
        },
    );

    burn(cpi_ctx, amount + BURN_AMOUNT)?;

    msg!("Successfully burned {} wUSDV", amount + BURN_AMOUNT);

    Ok(())
}

pub fn send_message(ctx: Context<SendMessage>, message: Vec<u8>) -> Result<()> {
    // If Wormhole requires a fee before posting a message, we need to
    // transfer lamports to the fee collector. Otherwise
    // `wormhole::post_message` will fail.
    let fee = ctx.accounts.wormhole_bridge.fee();
    if fee > 0 {
        solana_program::program::invoke(
            &solana_program::system_instruction::transfer(
                &ctx.accounts.payer.key(),
                &ctx.accounts.wormhole_fee_collector.key(),
                fee,
            ),
            &ctx.accounts.to_account_infos(),
        )?;
    }

    // Invoke `wormhole::post_message`.
    //
    // `wormhole::post_message` requires two signers: one for the emitter
    // and another for the wormhole message data. Both of these accounts
    // are owned by this program.
    //
    // There are two ways to handle the wormhole message data account:
    //   1. Using an extra keypair. You may to generate a keypair outside
    //      of this instruction and pass that keypair as an additional
    //      signer for the transaction. An integrator might use an extra
    //      keypair if the message can be "thrown away" (not easily
    //      retrievable without going back to this transaction hash to
    //      retrieve the message's pubkey).
    //   2. Generate a PDA. If we want some way to deserialize the message
    //      data written by the Wormhole program, we can use an account
    //      with an address derived by this program so we can use the PDA
    //      to access and deserialize the message data.
    //
    // In our example, we use method #2.
    let wormhole_emitter = &ctx.accounts.wormhole_emitter;
    let config = &ctx.accounts.config;

    // There is only one type of message that this example uses to
    // communicate with its foreign counterparts (payload ID == 1).
    let payload: Vec<u8> = WormholeMessage::Hello { message }.try_to_vec()?;

    wormhole::post_message(
        CpiContext::new_with_signer(
            ctx.accounts.wormhole_program.to_account_info(),
            wormhole::PostMessage {
                config: ctx.accounts.wormhole_bridge.to_account_info(),
                message: ctx.accounts.wormhole_message.to_account_info(),
                emitter: wormhole_emitter.to_account_info(),
                sequence: ctx.accounts.wormhole_sequence.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                fee_collector: ctx.accounts.wormhole_fee_collector.to_account_info(),
                clock: ctx.accounts.clock.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
            &[
                &[
                    SEED_PREFIX_SENT,
                    &ctx.accounts.wormhole_sequence.next_value().to_le_bytes()[..],
                    &[ctx.bumps.wormhole_message],
                ],
                &[wormhole::SEED_PREFIX_EMITTER, &[wormhole_emitter.bump]],
            ],
        ),
        config.batch_id,
        payload,
        config.finality.try_into().unwrap(),
    )?;

    // Done.
    Ok(())
}

pub fn receive_message(ctx: Context<ReceiveMessage>, vaa_hash: [u8; 32]) -> Result<()> {
    let posted_message = &ctx.accounts.posted;

    if let WormholeMessage::Hello { message } = posted_message.data() {
        // WormholeMessage cannot be larger than the maximum size of the account.
        require!(
            message.len() <= MESSAGE_MAX_LENGTH,
            CustomError::InvalidMessage,
        );

        // Save batch ID, keccak256 hash and message payload.
        let received = &mut ctx.accounts.received;
        received.batch_id = posted_message.batch_id();
        received.wormhole_message_hash = vaa_hash;
        received.message = message.clone();

        // Done
        Ok(())
    } else {
        Err(CustomError::InvalidMessage.into())
    }
}
 */
