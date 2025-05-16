import solana from "@wormhole-foundation/sdk/solana";
import { wormhole } from "@wormhole-foundation/sdk";
import { PublicKey } from "@solana/web3.js"; // Import if you haven't
import { assert, expect } from "chai";

export const getCoreBridge = async () => {
    const wh = await wormhole("Devnet", [solana]);
    const chain = wh.getChain("Solana");
    const coreBridge = await chain.getWormholeCore();

    return coreBridge;
}

export const getFalseAccountsAndCheckReal = (
    seeds: string | [string, Buffer],
    programId: PublicKey,
    realAccount: PublicKey,
) => {
    const possibleAccounts: PublicKey[] = [];
    for (let i = 255; i >= 0; --i) {
        const bumpByte = Buffer.alloc(1);
        bumpByte.writeUint8(i);
        try {
            possibleAccounts.push(
                PublicKey.createProgramAddressSync(
                    [
                        ...(typeof seeds === "string"
                            ? [Buffer.from(seeds)]
                            : [Buffer.from(seeds[0]), seeds[1]]
                        ),
                        bumpByte
                    ],
                    programId
                )
            );
        } catch (_) {
            // ignore
        }
    }
    expect(possibleAccounts.shift()!).deep.equals(realAccount);
    return possibleAccounts;
}