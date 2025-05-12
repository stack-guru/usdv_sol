import { PublicKey, PublicKeyInitData, TransactionInstruction } from "@solana/web3.js";
import { getPostMessageCpiAccounts } from "@wormhole-foundation/sdk-solana-core/dist/cjs/utils";
import { createProgramInterface } from "../program";
import { deriveConfigKey, deriveWormholeMessageKey } from "../accounts";

export async function createInitializeInstruction(
  programId: PublicKeyInitData,
  payer: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData
): Promise<TransactionInstruction> {
  const program = createProgramInterface();
  const message = deriveWormholeMessageKey(programId, 1n);
  const wormholeAccounts = getPostMessageCpiAccounts(
    program.programId,
    wormholeProgramId,
    payer,
    message
  );
  return program.methods
    .initialize()
    .accounts({
      owner: new PublicKey(payer),
      config: deriveConfigKey(programId),
      wormholeProgram: new PublicKey(wormholeProgramId),
      ...wormholeAccounts,
    })
    .instruction();
}
