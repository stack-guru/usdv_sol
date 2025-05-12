import { Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { UsdvBridge } from "../target/types/usdv_bridge";

export function createProgramInterface(): Program<UsdvBridge> {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.UsdvBridge as Program<UsdvBridge>;

    return program;
}
