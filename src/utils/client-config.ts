import { BlockfrostProvider } from "@meshsdk/core";

export const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY || '');
