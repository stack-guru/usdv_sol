import { CONTRACTS } from "@certusone/wormhole-sdk";
import { PublicKey } from "@solana/web3.js";

export const NETWORK = "TESTNET";

export const WORMHOLE_CONTRACTS = CONTRACTS[NETWORK];
export const CORE_BRIDGE_PID = new PublicKey(WORMHOLE_CONTRACTS.solana.core);