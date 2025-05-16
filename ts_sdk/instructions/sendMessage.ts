import { Connection, PublicKey, PublicKeyInitData, TransactionInstruction } from "@solana/web3.js";
import { createProgramInterface } from "../program";
import { deriveConfigKey, deriveWormholeMessageKey } from "../accounts";
import { getPostMessageCpiAccounts } from "@certusone/wormhole-sdk/lib/cjs/solana";
import { getProgramSequenceTracker } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";

export async function createSendMessageInstruction(
  connection: Connection,
  programId: PublicKeyInitData,
  payer: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  helloMessage: Buffer
): Promise<TransactionInstruction> {
  const program = createProgramInterface();

  // get sequence
  const message = await getProgramSequenceTracker(connection, programId, wormholeProgramId)
  .then((tracker) =>
    deriveWormholeMessageKey(programId, tracker.sequence + 1n)
  );
  const wormholeAccounts = getPostMessageCpiAccounts(
    programId,
    wormholeProgramId,
    payer,
    message
  );
  return program.methods
    .sendMessage(helloMessage)
    .accounts({
      config: deriveConfigKey(programId),
      wormholeProgram: new PublicKey(wormholeProgramId),
      ...wormholeAccounts,
    })
    .instruction();
}
