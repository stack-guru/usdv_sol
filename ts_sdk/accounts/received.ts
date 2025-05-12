import { ChainId } from "@wormhole-foundation/sdk";
import { utils } from '@wormhole-foundation/sdk-solana';
import { PublicKeyInitData } from "@solana/web3.js";
import { createProgramInterface } from "../program";

export function deriveReceivedKey(
  programId: PublicKeyInitData,
  chain: ChainId,
  sequence: bigint
) {
  return utils.deriveAddress(
    [
      Buffer.from("received"),
      (() => {
        const buf = Buffer.alloc(10);
        buf.writeUInt16LE(chain, 0);
        buf.writeBigInt64LE(sequence, 2);
        return buf;
      })(),
    ],
    programId
  );
}

export interface Received {
  batchId: number;
  message: Buffer;
}

export async function getReceivedData(
  programId: PublicKeyInitData,
  chain: ChainId,
  sequence: bigint
): Promise<Received> {
  const received = await createProgramInterface()
    .account.received.fetch(deriveReceivedKey(programId, chain, sequence));

  return {
    batchId: received.batchId,
    message: received.message as Buffer
  };
}
