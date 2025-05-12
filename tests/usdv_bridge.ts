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
import { getPostMessageCpiAccounts } from "@wormhole-foundation/sdk-solana-core/dist/cjs/utils";
import { wormhole } from "@wormhole-foundation/sdk";
import { utils } from '@wormhole-foundation/sdk-solana';

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

    mint = EXISTING_MINT;

    // Create user's associated token account for the mint
    const userTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      wallet.publicKey
    );

    userTokenAccount = userTokenAccountInfo.address;

  });

  it("should mint wUSDV to user", async () => {
    // const amount = 1_000_000; // 1 token with 6 decimals

    // try {
    //   await program.methods
    //     .mintWusdv(new anchor.BN(amount))
    //     .accounts({
    //       user: wallet.publicKey,
    //       userTokenAccount,
    //       tokenMint: mint,
    //       mintAuthority: mintAuthorityPda,
    //       tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    //     })
    //     .rpc();

    //   const userAccount = await getAccount(provider.connection, userTokenAccount);
    //   assert.strictEqual(Number(userAccount.amount), amount, "Minted amount mismatch");
    // } catch (err) {
    //   console.error("Mint failed", err);
    //   throw err;
    // }
  });

  it("should burn wUSDV from user", async () => {
    const amount = 500_000;

    try {
      const tx = await program.methods
        .burnWusdv(new anchor.BN(amount))
        .accounts({
          user: wallet.publicKey,
          userTokenAccount,
          tokenMint: mint,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([])
        .rpc();

      console.log("Burn + Wormhole Message Tx:", tx);

      const userAccountAfter = await getAccount(provider.connection, userTokenAccount);
      assert.strictEqual(Number(userAccountAfter.amount), 500_000, "Burned amount mismatch");
    } catch (err) {
      console.error("Burn failed", err);
      throw err;
    }
  });

});
