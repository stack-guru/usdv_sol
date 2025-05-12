import { ChainId } from "@wormhole-foundation/sdk";
import { utils } from '@wormhole-foundation/sdk-solana';
import { PublicKeyInitData } from "@solana/web3.js";
import { createProgramInterface } from "../program";

export function deriveForeignEmitterKey(
    programId: PublicKeyInitData,
    chain: ChainId
) {
    return utils.deriveAddress(
        [
            Buffer.from("foreign_emitter"),
            (() => {
                const buf = Buffer.alloc(2);
                buf.writeUInt16LE(chain);
                return buf;
            })(),
        ],
        programId
    );
}

export interface ForeignEmitter {
    chain: ChainId;
    address: Buffer;
}

export async function getForeignEmitterData(
    programId: PublicKeyInitData,
    chain: ChainId
): Promise<ForeignEmitter> {
    const { address } = await createProgramInterface()
        .account.foreignEmitter.fetch(deriveForeignEmitterKey(programId, chain));

    return {
        chain,
        address: Buffer.from(address),
    };
}
