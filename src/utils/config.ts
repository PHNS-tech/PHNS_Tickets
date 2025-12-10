"use server"

import { PinataSDK } from "pinata"

export const pinata = new PinataSDK({
  pinataJwt: `${process.env.PINATA_JWT}`,
  pinataGateway: `${process.env.NEXT_PUBLIC_GATEWAY_URL}`
})

// BlockfrostProvider is only imported when actually needed (lazy load)
let provider: any = null;
export const getBlockfrostProvider = async () => {
  if (!provider) {
    const { BlockfrostProvider } = await import("@meshsdk/core");
    provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY || '');
  }
  return provider;
}