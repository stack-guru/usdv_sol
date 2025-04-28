import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { UsdvBridge } from "../target/types/usdv_bridge";
import {
  createMint,
  createAssociatedTokenAccount,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";

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

    // Create mint with PDA as authority
    mint = await createMint(
      provider.connection,
      wallet.payer,
      mintAuthorityPda, // PDA as mint authority
      null,
      6
    );

    // Create user's associated token account for the mint
    userTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      wallet.publicKey
    );

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
    const amount = 500_000; // Amount to burn (half of what was minted)

    try {
      // Check the initial balance before burn
      const userAccountBefore = await getAccount(provider.connection, userTokenAccount);
      assert.strictEqual(
        Number(userAccountBefore.amount),
        1_000_000, // Ensure the user has enough tokens before burning
        "Pre-burn amount mismatch"
      );

      await program.methods
        .burnWusdv(new anchor.BN(amount))
        .accounts({
          user: wallet.publicKey,  // The user is the signer
          userTokenAccount,
          tokenMint: mint,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .rpc();

      // Check the balance after burning
      const userAccountAfter = await getAccount(provider.connection, userTokenAccount);
      assert.strictEqual(
        Number(userAccountAfter.amount),
        500_000, // Half of the tokens should remain after burning
        "Burned amount mismatch"
      );
    } catch (err) {
      console.error("Burn failed", err);
      throw err;
    }
  });
});
