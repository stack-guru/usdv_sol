import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { UsdvBridge } from "../target/types/usdv_bridge";
import {
  createMint,
  createAssociatedTokenAccount,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
  getMint
} from "@solana/spl-token";
import { assert, expect } from "chai";
import { PublicKey, Connection, clusterApiUrl, Ed25519Program } from "@solana/web3.js";
import { utils as solanaUtils } from '@wormhole-foundation/sdk-solana';
import { ChainId, chainToChainId } from "@wormhole-foundation/sdk";
import { utils as solanaCoreUtils } from "@wormhole-foundation/sdk-solana-core";
import { parseVaa, postVaaSolana } from "@certusone/wormhole-sdk";
import { CORE_BRIDGE_PID, TOKEN } from "./helpers/constants";
import { getPostedMessage } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import { NodeWallet } from "@certusone/wormhole-sdk/lib/cjs/solana";
import * as bridge from "../ts_sdk";
import * as dotenv from "dotenv";
dotenv.config();

const amoyAddress = process.env.AMOY_ADDRESS!;
const EXISTING_MINT = new PublicKey(TOKEN);
const connection = new Connection(clusterApiUrl("devnet"), "processed");

describe("wormhole bridge", function () {
  // Set up Anchor provider
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as anchor.Wallet;
  anchor.setProvider(provider);
  const program = anchor.workspace.UsdvBridge as Program<UsdvBridge>;
  const realForeignEmitter = bridge.deriveForeignEmitterKey(program.programId, chainToChainId("PolygonSepolia"));
  // const realForeignEmitterAddress = Buffer.alloc(32, amoyAddress, "hex");
  const realForeignEmitterAddress = Buffer.from(
    amoyAddress.toLowerCase().replace(/^0x/, "").padStart(64, "0"),
    "hex"
  );
  const realConfig = bridge.deriveConfigKey(program.programId);

  const wormholeCpi = solanaCoreUtils.getPostMessageCpiAccounts(
    program.programId,
    CORE_BRIDGE_PID,
    wallet.publicKey,
    bridge.deriveWormholeMessageKey(program.programId, 6n) // sequence should be increased for every test
  )

  // mint accounts
  let mint: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;
  let mintAuthorityPda: anchor.web3.PublicKey;

  describe("Bridge", function () {
    before(async function () {
      // const realInitializeAccounts = {
      //   owner: wallet.publicKey,
      //   config: realConfig,
      //   wormholeProgram: CORE_BRIDGE_PID,
      //   wormholeBridge: wormholeCpi.wormholeBridge,
      //   wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
      //   wormholeEmitter: wormholeCpi.wormholeEmitter,
      //   wormholeSequence: wormholeCpi.wormholeSequence,
      //   wormholeMessage: wormholeCpi.wormholeMessage,
      //   clock: wormholeCpi.clock,
      //   rent: wormholeCpi.rent,
      // };

      // const trx = await program.methods
      //   .initialize()
      //   .accounts({ ...realInitializeAccounts, })
      //   .rpc();
      // console.log('initialize trx = ', trx);

      // Derive the mint authority PDA (you must use this in your Rust logic)
      // new PublicKey("6G5WQR16vHBVviFJXZYQ2EfDvATDNEuwkA5aFWL71cVp")
      [mintAuthorityPda] = await anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("mint_authority")],
        program.programId
      );
      console.log('mintAuthorityPda = ', mintAuthorityPda);
      // 45PCyGdvK22QtkA66m5URuJyH41xQo5JChCWrC9ULKcA

      mint = EXISTING_MINT;

      // Create user's associated token account for the mint
      const userTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        mint,
        wallet.publicKey
      );

      userTokenAccount = userTokenAccountInfo.address;
      console.log('userTokenAccount = ', userTokenAccount)
    });

    it("should mint wUSDV to user", async () => {
      // const amount = 30_000_000; // 1 token with 6 decimals

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
      //   console.log('amount = ', Number(userAccount.amount))
      //   // assert.strictEqual(Number(userAccount.amount), amount, "Minted amount mismatch");
      // } catch (err) {
      //   console.error("Mint failed", err);
      //   throw err;
      // }
    });

    it("should burn wUSDV from user", async () => {
      // const amount = 0;

      // try {
      //   const tx = await program.methods
      //     .burnWusdv(new anchor.BN(amount))
      //     .accounts({
      //       user: wallet.publicKey,
      //       userTokenAccount,
      //       tokenMint: mint,
      //       tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      //     })
      //     .signers([])
      //     .rpc();

      //   console.log("Burn + Wormhole Message Tx:", tx);

      //   const userAccountAfter = await getAccount(provider.connection, userTokenAccount);
      //   // assert.strictEqual(Number(userAccountAfter.amount), 500_000, "Burned amount mismatch");
      //   console.log('amount = ', Number(userAccountAfter.amount))
      // } catch (err) {
      //   console.error("Burn failed", err);
      //   throw err;
      // }
    });

    it("should get foreign emitter", async () => {
      // const { chain, address } =
      //   await bridge.getForeignEmitterData(
      //     program.programId,
      //     chainToChainId("PolygonSepolia")
      //   );

      // console.log('realForeignEmitterAddress = ', realForeignEmitterAddress);
      // expect(chain).equals(chainToChainId("PolygonSepolia"));
      // expect(address).deep.equals(realForeignEmitterAddress);
    })

    it("should register emitter", async () => {
      // const realRegisterEmitterAccounts = {
      //   owner: wallet.publicKey,
      //   config: realConfig,
      //   foreignEmitter: realForeignEmitter,
      // }

      // const trx = await program.methods
      //   .registerEmitter(chainToChainId("PolygonSepolia"), [...realForeignEmitterAddress])
      //   .accounts({ ...realRegisterEmitterAccounts })
      //   .rpc();

      // console.log('register emitter trx = ', trx);
    })

    it("should send message", async () => {
      // const helloMessage = Buffer.from("send message from Solana");

      // // save message count to grab posted message later
      // const sequence = (
      //   await solanaCoreUtils.getProgramSequenceTracker(connection, program.programId, CORE_BRIDGE_PID)
      // ).value() + 1n;
      // console.log('sequence = ', sequence);

      // const trx = await program.methods
      //   .sendMessage(helloMessage)
      //   .accounts({
      //     payer: wallet.publicKey,
      //     config: realConfig,
      //     wormholeProgram: CORE_BRIDGE_PID,
      //     wormholeBridge: wormholeCpi.wormholeBridge,
      //     wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
      //     wormholeEmitter: wormholeCpi.wormholeEmitter,
      //     wormholeSequence: wormholeCpi.wormholeSequence,
      //     wormholeMessage: wormholeCpi.wormholeMessage,
      //     clock: wormholeCpi.clock,
      //     rent: wormholeCpi.rent,
      //   })
      //   .rpc();

      // console.log('send message trx = ', trx);
      // const { payload } =
      //   (await getPostedMessage(
      //     connection,
      //     bridge.deriveWormholeMessageKey(program.programId, sequence)
      //   )).message;

      // expect(payload.readUint8(0)).equals(1); // payload ID
      // expect(payload.readUint16BE(1)).equals(helloMessage.length);
      // expect(payload.subarray(3)).deep.equals(helloMessage);
    });

    it("should burn and send", async () => {
      // const burnAmount = 1_000_000;

      // const tx = await program.methods
      //   .burnAndSend(new anchor.BN(burnAmount))
      //   .accounts({
      //     payer: wallet.publicKey,
      //     config: realConfig,
      //     wormholeProgram: CORE_BRIDGE_PID,
      //     wormholeBridge: wormholeCpi.wormholeBridge,
      //     wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
      //     wormholeEmitter: wormholeCpi.wormholeEmitter,
      //     wormholeSequence: wormholeCpi.wormholeSequence,
      //     wormholeMessage: wormholeCpi.wormholeMessage,
      //     clock: wormholeCpi.clock,
      //     rent: wormholeCpi.rent,
      //     user: wallet.publicKey,
      //     userTokenAccount,
      //     tokenMint: mint,
      //     tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      //   })
      //   .rpc();

      // console.log("Burn + Wormhole Message Tx:", tx);

      // const userAccountAfter = await getAccount(provider.connection, userTokenAccount);
      // console.log('remain amount = ', Number(userAccountAfter.amount));
    });

    it("should receive message", async () => {
      // const buffer = Buffer.from("AQAAAAABAF3ehEopD6n8ej1hwh2D4kvifKPbWoVm+lYP7sgN64muVfDVdoNSreoWsKiVFGOW5+9im2VPTl5dfOECTnQ4qFsAaDeWOQAAAAAnFwAAAAAAAAAAAAAAAB7FWP1ULTVLeBioqPgSS2458BW5AAAAAAAAAAQBAQAGc3RyZXNz", 'base64');
      // const parsed = parseVaa(buffer);

      // console.log('parsed = ', parsed);

      // const nodeWallet = NodeWallet.fromSecretKey(wallet.payer.secretKey);
      // console.log('node wallet = ', nodeWallet);

      // const posted = await postVaaSolana(
      //   connection,
      //   nodeWallet.signTransaction,
      //   CORE_BRIDGE_PID,
      //   nodeWallet.key(),
      //   buffer
      // );

      // console.log('posted = ', posted);

      // return program.methods
      //   .receiveMessage([...parsed.hash])
      //   .accounts({
      //     payer: wallet.publicKey,
      //     config: bridge.deriveConfigKey(program.programId),
      //     wormholeProgram: new PublicKey(CORE_BRIDGE_PID),
      //     posted: solanaCoreUtils.derivePostedVaaKey(CORE_BRIDGE_PID, parsed.hash),
      //     foreignEmitter: bridge.deriveForeignEmitterKey(program.programId, parsed.emitterChain as ChainId),
      //     received: bridge.deriveReceivedKey(
      //       program.programId,
      //       parsed.emitterChain as ChainId,
      //       parsed.sequence
      //     ),
      //   })
      //   .rpc();
    })

    it("should get received message", async () => {
      // const buffer = Buffer.from("AQAAAAABAF3ehEopD6n8ej1hwh2D4kvifKPbWoVm+lYP7sgN64muVfDVdoNSreoWsKiVFGOW5+9im2VPTl5dfOECTnQ4qFsAaDeWOQAAAAAnFwAAAAAAAAAAAAAAAB7FWP1ULTVLeBioqPgSS2458BW5AAAAAAAAAAQBAQAGc3RyZXNz", 'base64');
      // const parsed = parseVaa(buffer);
      // const received = await bridge.getReceivedData(
      //   program.programId,
      //   parsed.emitterChain as ChainId, // don't do this at home, kids
      //   parsed.sequence
      // );

      // console.log('batch id & message = ', received.batchId, received.message.toString());
      // // expect(received.batchId).equals(batchId);
      // // expect(received.message).deep.equals(message);
    })

    it("should enable public mint", async () => {
      // const isMintable = true
      // const accounts = {
      //   owner: wallet.publicKey,
      //   config: realConfig
      // }

      // const trx = await program.methods
      //   .setPublicMint(isMintable)
      //   .accounts({ ...accounts })
      //   .rpc();

      // const configAccount = await program.account.config.fetch(realConfig);
      // expect(isMintable).equal(configAccount.isPublicMint);
    })

    it("should receive message and mint token", async () => {
      // const buffer = Buffer.from("AQAAAAABAKOEa4F2+xP8knW1BuQPhbELC7madqeHcl8JKjFEnWl4UBJQTVMvnLCKVvUNcMUwVDGAvSXmfCX4pDLOh2ttBdYBaD8IeAAAAAAnFwAAAAAAAAAAAAAAAB7FWP1ULTVLeBioqPgSS2458BW5AAAAAAAAAAUBAQADMTAw", 'base64');
      // const parsed = parseVaa(buffer);

      // console.log('parsed = ', parsed);

      // const nodeWallet = NodeWallet.fromSecretKey(wallet.payer.secretKey);

      // const posted = await postVaaSolana(
      //   connection,
      //   nodeWallet.signTransaction,
      //   CORE_BRIDGE_PID,
      //   nodeWallet.key(),
      //   buffer
      // );

      // console.log('posted!');

      // const trx = await program.methods
      //   .receiveAndMint([...parsed.hash])
      //   .accounts({
      //     payer: wallet.publicKey,
      //     config: realConfig,
      //     wormholeProgram: new PublicKey(CORE_BRIDGE_PID),
      //     posted: solanaCoreUtils.derivePostedVaaKey(CORE_BRIDGE_PID, parsed.hash),
      //     foreignEmitter: bridge.deriveForeignEmitterKey(program.programId, parsed.emitterChain as ChainId),
      //     received: bridge.deriveReceivedKey(
      //       program.programId,
      //       parsed.emitterChain as ChainId,
      //       parsed.sequence
      //     ),
      //     user: wallet.publicKey,
      //     userTokenAccount,
      //     tokenMint: mint,
      //     mintAuthority: mintAuthorityPda,
      //     tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      //   })
      //   .rpc();

      // console.log('receive and mint trx = ', trx);
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
  //     const amount = 1_000_000; // 1 token with 6 decimals

  //     try {
  //       await program.methods
  //         .mintWusdv(new anchor.BN(amount))
  //         .accounts({
  //           user: wallet.publicKey,
  //           userTokenAccount,
  //           tokenMint: mint,
  //           mintAuthority: mintAuthorityPda,
  //           tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  //         })
  //         .rpc();

  //       const userAccount = await getAccount(provider.connection, userTokenAccount);
  //       assert.strictEqual(Number(userAccount.amount), amount, "Minted amount mismatch");
  //     } catch (err) {
  //       console.error("Mint failed", err);
  //       throw err;
  //     }
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
