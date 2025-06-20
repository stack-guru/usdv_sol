use anchor_lang::prelude::*;
// use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::token_interface::{spl_token_2022, Mint, Token2022, TokenAccount};
use wormhole_anchor_sdk::wormhole::{self, program::Wormhole};

pub const SEED_PREFIX_SENT: &[u8; 4] = b"sent";

use crate::{
    error::CustomError,
    message::WormholeMessage,
    state::{Config, ForeignEmitter, Received, WormholeEmitter},
};

#[derive(Accounts)]
/// Context used to initialize program data (i.e. config).
pub struct Initialize<'info> {
    #[account(mut)]
    /// Whoever initializes the config will be the owner of the program. Signer
    /// for creating the [`Config`] account and posting a Wormhole message
    /// indicating that the program is alive.
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        seeds = [Config::SEED_PREFIX],
        bump,
        space = Config::MAXIMUM_SIZE,

    )]
    /// Config account, which saves program data useful for other instructions.
    /// Also saves the payer of the [`initialize`](crate::initialize) instruction
    /// as the program's owner.
    pub config: Account<'info, Config>,

    /// Wormhole program.
    pub wormhole_program: Program<'info, Wormhole>,

    #[account(
        mut,
        seeds = [wormhole::BridgeData::SEED_PREFIX],
        bump,
        seeds::program = wormhole_program.key,
    )]
    /// Wormhole bridge data account (a.k.a. its config).
    /// [`wormhole::post_message`] requires this account be mutable.
    pub wormhole_bridge: Account<'info, wormhole::BridgeData>,

    #[account(
        mut,
        seeds = [wormhole::FeeCollector::SEED_PREFIX],
        bump,
        seeds::program = wormhole_program.key
    )]
    /// Wormhole fee collector account, which requires lamports before the
    /// program can post a message (if there is a fee).
    /// [`wormhole::post_message`] requires this account be mutable.
    pub wormhole_fee_collector: Account<'info, wormhole::FeeCollector>,

    #[account(
        init,
        payer = owner,
        seeds = [WormholeEmitter::SEED_PREFIX],
        bump,
        space = WormholeEmitter::MAXIMUM_SIZE
    )]
    /// This program's emitter account. We create this account in the
    /// [`initialize`](crate::initialize) instruction, but
    /// [`wormhole::post_message`] only needs it to be read-only.
    pub wormhole_emitter: Account<'info, WormholeEmitter>,

    #[account(
        mut,
        seeds = [
            wormhole::SequenceTracker::SEED_PREFIX,
            wormhole_emitter.key().as_ref()
        ],
        bump,
        seeds::program = wormhole_program.key
    )]
    /// CHECK: Emitter's sequence account. This is not created until the first
    /// message is posted, so it needs to be an [UncheckedAccount] for the
    /// [`initialize`](crate::initialize) instruction.
    /// [`wormhole::post_message`] requires this account be mutable.
    pub wormhole_sequence: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX_SENT,
            &wormhole::INITIAL_SEQUENCE.to_le_bytes()[..]
        ],
        bump,
    )]
    /// CHECK: Wormhole message account. The Wormhole program writes to this
    /// account, which requires this program's signature.
    /// [`wormhole::post_message`] requires this account be mutable.
    pub wormhole_message: UncheckedAccount<'info>,

    /// Clock sysvar.
    pub clock: Sysvar<'info, Clock>,

    /// Rent sysvar.
    pub rent: Sysvar<'info, Rent>,

    /// System program.
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(chain: u16)]
pub struct RegisterEmitter<'info> {
    #[account(mut)]
    /// Owner of the program set in the [`Config`] account. Signer for creating
    /// the [`ForeignEmitter`] account.
    pub owner: Signer<'info>,

    #[account(
        has_one = owner @ CustomError::OwnerOnly,
        seeds = [Config::SEED_PREFIX],
        bump
    )]
    /// Config account. This program requires that the `owner` specified in the
    /// context equals the pubkey specified in this account. Read-only.
    pub config: Account<'info, Config>,

    #[account(
        init_if_needed,
        payer = owner,
        seeds = [
            ForeignEmitter::SEED_PREFIX,
            &chain.to_le_bytes()[..]
        ],
        bump,
        space = ForeignEmitter::MAXIMUM_SIZE
    )]
    /// Foreign Emitter account. Create this account if an emitter has not been
    /// registered yet for this Wormhole chain ID. If there already is an
    /// emitter address saved in this account, overwrite it.
    pub foreign_emitter: Account<'info, ForeignEmitter>,

    /// System program.
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPublicMint<'info> {
    #[account(mut, seeds = [Config::SEED_PREFIX], bump, has_one = owner)]
    pub config: Account<'info, Config>,

    pub owner: Signer<'info>,
}

type WormholeVaa = wormhole::PostedVaa<WormholeMessage>;

#[derive(Accounts)]
#[instruction(vaa_hash: [u8; 32])]
pub struct ReceiveAndMint<'info> {
    /// User who receives the minted tokens
    #[account(mut)]
    pub user: Signer<'info>,

    /// Pays for account initialization
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
    pub config: Account<'info, Config>,

    pub wormhole_program: Program<'info, Wormhole>,

    #[account(
        seeds = [
            wormhole::SEED_PREFIX_POSTED_VAA,
            &vaa_hash
        ],
        bump,
        seeds::program = wormhole_program.key
    )]
    pub posted: Account<'info, WormholeVaa>,

    #[account(
        seeds = [
            ForeignEmitter::SEED_PREFIX,
            &posted.emitter_chain().to_le_bytes()[..]
        ],
        bump,
        constraint = foreign_emitter.verify(posted.emitter_address()) @ CustomError::InvalidForeignEmitter
    )]
    pub foreign_emitter: Account<'info, ForeignEmitter>,

    #[account(
        init,
        payer = payer,
        seeds = [
            Received::SEED_PREFIX,
            &posted.emitter_chain().to_le_bytes()[..],
            &posted.sequence().to_le_bytes()[..]
        ],
        bump,
        space = Received::MAXIMUM_SIZE
    )]
    pub received: Account<'info, Received>,

    // MINT-related accounts
    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, constraint = token_mint.decimals == 6 @ CustomError::InvalidMintDecimals)]
    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [b"mint_authority"],
        bump
    )]
    /// CHECK: Verified in CPI context
    pub mint_authority: AccountInfo<'info>,

    #[account(address = spl_token_2022::id())]
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BurnAndSendMessage<'info> {
    #[account(mut)]
    pub user: Signer<'info>, // signer, but not checking token account owner

    #[account(mut)]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>, // token account to burn from

    #[account(mut, constraint = token_mint.decimals == 6 @ CustomError::InvalidMintDecimals)]
    pub token_mint: InterfaceAccount<'info, Mint>, // the token mint

    #[account(address = spl_token_2022::id())]
    pub token_program: Program<'info, Token2022>,

    #[account(mut)]
    /// Payer will pay Wormhole fee to post a message.
    pub payer: Signer<'info>,

    #[account(
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
    pub config: Account<'info, Config>,

    pub wormhole_program: Program<'info, Wormhole>,

    #[account(
        mut,
        address = config.wormhole.bridge @ CustomError::InvalidWormholeConfig
    )]
    pub wormhole_bridge: Account<'info, wormhole::BridgeData>,

    #[account(
        mut,
        address = config.wormhole.fee_collector @ CustomError::InvalidWormholeFeeCollector
    )]
    pub wormhole_fee_collector: Account<'info, wormhole::FeeCollector>,

    #[account(
        seeds = [WormholeEmitter::SEED_PREFIX],
        bump,
    )]
    pub wormhole_emitter: Account<'info, WormholeEmitter>,

    #[account(
        mut,
        address = config.wormhole.sequence @ CustomError::InvalidWormholeSequence
    )]
    pub wormhole_sequence: Account<'info, wormhole::SequenceTracker>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX_SENT,
            &wormhole_sequence.next_value().to_le_bytes()[..]
        ],
        bump,
    )]
    /// CHECK: Wormhole Message. [`wormhole::post_message`] requires this
    /// account be mutable.
    pub wormhole_message: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
}

/*
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
    pub user: Signer<'info>, // signer, but not checking token account owner

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>, // token account to burn from

    #[account(mut, constraint = token_mint.decimals == 6 @ CustomError::InvalidMintDecimals)]
    pub token_mint: Account<'info, Mint>, // the token mint

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SendMessage<'info> {
    #[account(mut)]
    /// Payer will pay Wormhole fee to post a message.
    pub payer: Signer<'info>,

    #[account(
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
    /// Config account. Wormhole PDAs specified in the config are checked
    /// against the Wormhole accounts in this context. Read-only.
    pub config: Account<'info, Config>,

    /// Wormhole program.
    pub wormhole_program: Program<'info, Wormhole>,

    #[account(
        mut,
        address = config.wormhole.bridge @ CustomError::InvalidWormholeConfig
    )]
    /// Wormhole bridge data. [`wormhole::post_message`] requires this account
    /// be mutable.
    pub wormhole_bridge: Account<'info, wormhole::BridgeData>,

    #[account(
        mut,
        address = config.wormhole.fee_collector @ CustomError::InvalidWormholeFeeCollector
    )]
    /// Wormhole fee collector. [`wormhole::post_message`] requires this
    /// account be mutable.
    pub wormhole_fee_collector: Account<'info, wormhole::FeeCollector>,

    #[account(
        seeds = [WormholeEmitter::SEED_PREFIX],
        bump,
    )]
    /// Program's emitter account. Read-only.
    pub wormhole_emitter: Account<'info, WormholeEmitter>,

    #[account(
        mut,
        address = config.wormhole.sequence @ CustomError::InvalidWormholeSequence
    )]
    /// Emitter's sequence account. [`wormhole::post_message`] requires this
    /// account be mutable.
    pub wormhole_sequence: Account<'info, wormhole::SequenceTracker>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX_SENT,
            &wormhole_sequence.next_value().to_le_bytes()[..]
        ],
        bump,
    )]
    /// CHECK: Wormhole Message. [`wormhole::post_message`] requires this
    /// account be mutable.
    pub wormhole_message: UncheckedAccount<'info>,

    /// System program.
    pub system_program: Program<'info, System>,

    /// Clock sysvar.
    pub clock: Sysvar<'info, Clock>,

    /// Rent sysvar.
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(vaa_hash: [u8; 32])]
pub struct ReceiveMessage<'info> {
    #[account(mut)]
    /// Payer will initialize an account that tracks his own message IDs.
    pub payer: Signer<'info>,

    #[account(
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
    /// Config account. Wormhole PDAs specified in the config are checked
    /// against the Wormhole accounts in this context. Read-only.
    pub config: Account<'info, Config>,

    // Wormhole program.
    pub wormhole_program: Program<'info, Wormhole>,

    #[account(
        seeds = [
            wormhole::SEED_PREFIX_POSTED_VAA,
            &vaa_hash
        ],
        bump,
        seeds::program = wormhole_program.key
    )]
    /// Verified Wormhole message account. The Wormhole program verified
    /// signatures and posted the account data here. Read-only.
    pub posted: Account<'info, WormholeVaa>,

    #[account(
        seeds = [
            ForeignEmitter::SEED_PREFIX,
            &posted.emitter_chain().to_le_bytes()[..]
        ],
        bump,
        constraint = foreign_emitter.verify(posted.emitter_address()) @ CustomError::InvalidForeignEmitter
    )]
    /// Foreign emitter account. The posted message's `emitter_address` must
    /// agree with the one we have registered for this message's `emitter_chain`
    /// (chain ID). Read-only.
    pub foreign_emitter: Account<'info, ForeignEmitter>,

    #[account(
        init,
        payer = payer,
        seeds = [
            Received::SEED_PREFIX,
            &posted.emitter_chain().to_le_bytes()[..],
            &posted.sequence().to_le_bytes()[..]
        ],
        bump,
        space = Received::MAXIMUM_SIZE
    )]
    /// Received account. [`receive_message`](crate::receive_message) will
    /// deserialize the Wormhole message's payload and save it to this account.
    /// This account cannot be overwritten, and will prevent Wormhole message
    /// replay with the same sequence.
    pub received: Account<'info, Received>,

    /// System program.
    pub system_program: Program<'info, System>,
}
 */
