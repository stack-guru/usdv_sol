import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { UsdvBridge } from "../target/types/usdv_bridge";
import {
  createMint,
  createAssociatedTokenAccount,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";
import { PublicKey, SYSVAR_RENT_PUBKEY, SYSVAR_CLOCK_PUBKEY, SystemProgram } from "@solana/web3.js"; // Import if you haven't

const EXISTING_MINT = new PublicKey("CUeFA3eTUcKCctTWuieMXLvn9ChAaMi5z6QhLRzJL3qn");
const WORMHOLE_PROGRAM_ID = new PublicKey("Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o");

describe("usdv_bridge", () => {
  // Set up Anchor provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.UsdvBridge as Program<UsdvBridge>;
  const wallet = provider.wallet as anchor.Wallet;

  let mint: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;
  let mintAuthorityPda: anchor.web3.PublicKey;
  let burnAuthorityPda: anchor.web3.PublicKey;
  let burnAuthorityBump: number;

  before(async () => {
    // Derive the mint authority PDA (you must use this in your Rust logic)
    [mintAuthorityPda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mint_authority")],
      program.programId
    );

    // Derive the burn authority PDA
    [burnAuthorityPda, burnAuthorityBump] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("burn_authority")],
      program.programId
    );

    // // Create mint with PDA as authority
    // mint = await createMint(
    //   provider.connection,
    //   wallet.payer,
    //   mintAuthorityPda, // PDA as mint authority
    //   null,
    //   6
    // );

    mint = EXISTING_MINT;

    // Create user's associated token account for the mint
    const userTokenAccountInfo  = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      wallet.publicKey
    );

    userTokenAccount = userTokenAccountInfo.address;
    // // Fund the user's token account with some tokens to burn
    // const amount = 1_000_000; // 1 token with 6 decimals
    // await mintTo(
    //   provider.connection,
    //   wallet.payer,
    //   mint,
    //   userTokenAccount,
    //   mintAuthorityPda, // mint authority is used to mint tokens
    //   amount
    // );
  });

  it("should mint wUSDV to user", async () => {
    const amount = 1_000_000; // 1 token with 6 decimals

    try {
      await program.methods
        .mintWusdv(new anchor.BN(amount))
        .accounts({
          user: wallet.publicKey,
          userTokenAccount,
          tokenMint: mint,
          mintAuthority: mintAuthorityPda,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .rpc();

      const userAccount = await getAccount(provider.connection, userTokenAccount);
      assert.strictEqual(Number(userAccount.amount), amount, "Minted amount mismatch");
    } catch (err) {
      console.error("Mint failed", err);
      throw err;
    }
  });

  it("should burn wUSDV from user", async () => {
    const amount = 500_000; // Amount to burn
    const nonce = 42; // Use any nonce (should be unique per burn)
  
    // Derive PDAs
    const [wormholeEmitter] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("emitter")],
      program.programId
    );
  
    const [wormholeMessage] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("message"), wallet.publicKey.toBuffer(), Buffer.from([nonce])],
      program.programId
    );
  
    const wormholeSequence = anchor.web3.Keypair.generate(); // Just use a new keypair for mock testing
  
    // Mock Wormhole config and fee collector (replace with real ones in integration)
    const wormholeConfig = anchor.web3.Keypair.generate(); // replace in real test
    const wormholeFeeCollector = anchor.web3.Keypair.generate(); // replace in real test
  
    try {
      const tx = await program.methods
        .burnWusdv(new anchor.BN(amount), wallet.publicKey, nonce)
        .accounts({
          user: wallet.publicKey,
          userTokenAccount,
          tokenMint: mint,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  
          wormholeProgram: WORMHOLE_PROGRAM_ID,
          wormholeConfig: wormholeConfig.publicKey,
          wormholeMessage,
          wormholeEmitter,
          wormholeSequence: wormholeSequence.publicKey,
          wormholePayer: wallet.publicKey,
          wormholeFeeCollector: wormholeFeeCollector.publicKey,
  
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .signers([]) // Add wormholeSequence and feeCollector if they were keypairs
        .rpc();
  
      console.log("Burn + Wormhole Message Tx:", tx);
  
      const userAccountAfter = await getAccount(provider.connection, userTokenAccount);
      assert.strictEqual(
        Number(userAccountAfter.amount),
        500_000,
        "Burned amount mismatch"
      );
    } catch (err) {
      console.error("Burn failed", err);
      throw err;
    }
  });
});
