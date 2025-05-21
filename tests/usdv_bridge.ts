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
import { assert, expect } from "chai";
import { PublicKey, Connection, clusterApiUrl, Ed25519Program } from "@solana/web3.js";
import { utils as solanaUtils } from '@wormhole-foundation/sdk-solana';
import { utils as solanaCoreUtils } from "@wormhole-foundation/sdk-solana-core";
import { CORE_BRIDGE_PID } from "./helpers/constants";
import { getPostedMessage } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import * as bridge from "../ts_sdk";

const EXISTING_MINT = new PublicKey("CUeFA3eTUcKCctTWuieMXLvn9ChAaMi5z6QhLRzJL3qn");
const connection = new Connection(clusterApiUrl("devnet"), "processed");

describe("wormhole bridge", function () {
  // Set up Anchor provider
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as anchor.Wallet;
  anchor.setProvider(provider);
  const program = anchor.workspace.UsdvBridge as Program<UsdvBridge>;

  // const realForeignEmitter = bridge.deriveForeignEmitterKey(WORMHOLE_PROGRAM_ID, chainToChainId("Ethereum"));
  const realConfig = bridge.deriveConfigKey(program.programId);

  const wormholeCpi = solanaCoreUtils.getPostMessageCpiAccounts(
    program.programId,
    CORE_BRIDGE_PID,
    wallet.publicKey,
    bridge.deriveWormholeMessageKey(program.programId, 2n) // sequence should be increased for every test
  );

  describe("Bridge", function () {
    // before(async function () {
    //   const realInitializeAccounts = {
    //     owner: wallet.publicKey,
    //     config: realConfig,
    //     wormholeProgram: CORE_BRIDGE_PID,
    //     wormholeBridge: wormholeCpi.wormholeBridge,
    //     wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
    //     wormholeEmitter: wormholeCpi.wormholeEmitter,
    //     wormholeSequence: wormholeCpi.wormholeSequence,
    //     wormholeMessage: wormholeCpi.wormholeMessage,
    //     clock: wormholeCpi.clock,
    //     rent: wormholeCpi.rent,
    //   };

    //   const trx = await program.methods
    //     .initialize()
    //     .accounts({ ...realInitializeAccounts, })
    //     .rpc();

    //   console.log('initialize trx = ', trx);
    // });

    it("should send message", async () => {
      const helloMessage = Buffer.from("All your base are belong to us");

      // save message count to grab posted message later
      const sequence = (
        await solanaCoreUtils.getProgramSequenceTracker(connection, program.programId, CORE_BRIDGE_PID)
      ).value() + 1n;
      console.log('sequence = ', sequence);

      const trx = await program.methods
        .sendMessage(helloMessage)
        .accounts({
          payer: wallet.publicKey,
          config: realConfig,
          wormholeProgram: CORE_BRIDGE_PID,
          wormholeBridge: wormholeCpi.wormholeBridge,
          wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
          wormholeEmitter: wormholeCpi.wormholeEmitter,
          wormholeSequence: wormholeCpi.wormholeSequence,
          wormholeMessage: wormholeCpi.wormholeMessage,
          clock: wormholeCpi.clock,
          rent: wormholeCpi.rent,
        })
        .rpc();

      console.log('send message trx = ', trx);
      const { payload } =
        (await getPostedMessage(
          connection,
          bridge.deriveWormholeMessageKey(program.programId, sequence)
        )).message;

      expect(payload.readUint8(0)).equals(1); // payload ID
      expect(payload.readUint16BE(1)).equals(helloMessage.length);
      expect(payload.subarray(3)).deep.equals(helloMessage);
    });

    it("should receive message", async () => {

    })
  });

  // describe("usdv_bridge", () => {
  //   let mint: anchor.web3.PublicKey;
  //   let userTokenAccount: anchor.web3.PublicKey;
  //   let mintAuthorityPda: anchor.web3.PublicKey;
  //   let burnAuthorityPda: anchor.web3.PublicKey;
  //   let burnAuthorityBump: number;

  //   before(async () => {
  //     // Derive the mint authority PDA (you must use this in your Rust logic)
  //     [mintAuthorityPda] = await anchor.web3.PublicKey.findProgramAddressSync(
  //       [Buffer.from("mint_authority")],
  //       program.programId
  //     );

  //     // Derive the burn authority PDA
  //     [burnAuthorityPda, burnAuthorityBump] = await anchor.web3.PublicKey.findProgramAddressSync(
  //       [Buffer.from("burn_authority")],
  //       program.programId
  //     );

  //     mint = EXISTING_MINT;

  //     // Create user's associated token account for the mint
  //     const userTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
  //       provider.connection,
  //       wallet.payer,
  //       mint,
  //       wallet.publicKey
  //     );

  //     userTokenAccount = userTokenAccountInfo.address;
  //   });

  //   it("should mint wUSDV to user", async () => {
  //     // const amount = 1_000_000; // 1 token with 6 decimals

  //     // try {
  //     //   await program.methods
  //     //     .mintWusdv(new anchor.BN(amount))
  //     //     .accounts({
  //     //       user: wallet.publicKey,
  //     //       userTokenAccount,
  //     //       tokenMint: mint,
  //     //       mintAuthority: mintAuthorityPda,
  //     //       tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  //     //     })
  //     //     .rpc();

  //     //   const userAccount = await getAccount(provider.connection, userTokenAccount);
  //     //   assert.strictEqual(Number(userAccount.amount), amount, "Minted amount mismatch");
  //     // } catch (err) {
  //     //   console.error("Mint failed", err);
  //     //   throw err;
  //     // }
  //   });

  //   it("should burn wUSDV from user", async () => {
  //     const amount = 500_000;

  //     try {
  //       const tx = await program.methods
  //         .burnWusdv(new anchor.BN(amount))
  //         .accounts({
  //           user: wallet.publicKey,
  //           userTokenAccount,
  //           tokenMint: mint,
  //           tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  //         })
  //         .signers([])
  //         .rpc();

  //       console.log("Burn + Wormhole Message Tx:", tx);

  //       const userAccountAfter = await getAccount(provider.connection, userTokenAccount);
  //       assert.strictEqual(Number(userAccountAfter.amount), 500_000, "Burned amount mismatch");
  //     } catch (err) {
  //       console.error("Burn failed", err);
  //       throw err;
  //     }
  //   });

  // });
})
