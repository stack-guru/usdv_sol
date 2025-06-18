import { CONTRACTS } from "@certusone/wormhole-sdk";
import { PublicKey } from "@solana/web3.js";

export const NETWORK = "TESTNET";

export const WORMHOLE_CONTRACTS = CONTRACTS[NETWORK];
export const CORE_BRIDGE_PID = new PublicKey(WORMHOLE_CONTRACTS.solana.core);
export const EX_TOKEN = "Dkz4WrqjhmgqQjHaZb5q26hh79JkgMApS2i8qaxi5PKt";
export const TOKEN = "2MkE8gyUMMfNBFEjksvEY7KSbLoh1Vk7MNJc7si3JnPn";