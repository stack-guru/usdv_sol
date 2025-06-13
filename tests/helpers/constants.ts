import { CONTRACTS } from "@certusone/wormhole-sdk";
import { PublicKey } from "@solana/web3.js";

export const NETWORK = "TESTNET";

export const WORMHOLE_CONTRACTS = CONTRACTS[NETWORK];
export const CORE_BRIDGE_PID = new PublicKey(WORMHOLE_CONTRACTS.solana.core);
export const EX_TOKEN = "Dkz4WrqjhmgqQjHaZb5q26hh79JkgMApS2i8qaxi5PKt";
export const TOKEN = "FsQ1C1yYk5vQxLYHos4C1rab7RExjCj8ED1v9AdfrrFB";