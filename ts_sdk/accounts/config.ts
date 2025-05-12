import { utils } from '@wormhole-foundation/sdk-solana';
import { PublicKey, PublicKeyInitData } from "@solana/web3.js";
import { createProgramInterface } from "../program";

export function deriveConfigKey(programId: PublicKeyInitData) {
    return utils.deriveAddress([Buffer.from("config")], programId);
}

export interface WormholeAddresses {
    bridge: PublicKey;
    feeCollector: PublicKey;
    sequence: PublicKey;
}

export interface ConfigData {
    owner: PublicKey;
    wormhole: WormholeAddresses;
}

export async function getConfigData(programId): Promise<ConfigData> {
    const data = await createProgramInterface().account.config.fetch(deriveConfigKey(programId));

    return {
        owner: data.owner,
        wormhole: data.wormhole,
    };
}
