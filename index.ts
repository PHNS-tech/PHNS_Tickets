import 'dotenv/config';
import { BlockfrostProvider, MeshWallet } from "@meshsdk/core";
import { Contract } from "./src/offchain";

const blockchainProvider = new BlockfrostProvider(
    process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY || ""
);

const wallet = new MeshWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
        type: "mnemonic",
        words: process.env.MNEMONIC?.split(" ") || [],
    },
});

const contract = new Contract({
    wallet: wallet,
    blockfrostProvider: blockchainProvider,
});

const [, , command, ...args] = process.argv;

if (command === 'lock') {
    const lock = async () => {
        const txHash = await contract.lockAsset({
            seller: args[0] || undefined,
            status: args[1] || undefined,
            unit: args[2] || "lovelace",
            quantity: args[3] || "2000000",
        });
        console.log("Lock TX Hash:", txHash);
    };
    lock().catch((e) => console.error('Lock failed:', e));
} else if (command === 'unlock') {
    const unlock = async () => {
        const txHash = await contract.unlockAsset({
            txHash: args[0],
            redeemer: args[1] || "test_redeemer",
        });
        console.log("Unlock TX Hash:", txHash);
    };
    unlock().catch((e) => console.error('Unlock failed:', e));
} else {
    console.log("Usage: npx tsx index.ts lock [datum] [unit] [quantity]");
    console.log("       npx tsx index.ts unlock <txHash> [redeemer]");
}