import { utils } from '@wormhole-foundation/sdk-solana';
import { deriveWormholeEmitterKey } from '@wormhole-foundation/sdk-solana-core/dist/cjs/utils';
import { PublicKeyInitData } from "@solana/web3.js";
import { createProgramInterface } from "../program";

export { deriveWormholeEmitterKey };

export function deriveWormholeMessageKey(
  programId: PublicKeyInitData,
  sequence: bigint
) {
  return utils.deriveAddress(
    [
      Buffer.from("sent"),
      (() => {
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64LE(sequence);
        return buf;
      })(),
    ],
    programId
  );
}

export interface WormholeEmitterData {
  bump: number;
}

export async function getWormholeEmitterData(
  programId: PublicKeyInitData
): Promise<WormholeEmitterData> {
  return createProgramInterface()
    .account.wormholeEmitter.fetch(deriveWormholeEmitterKey(programId));
}
