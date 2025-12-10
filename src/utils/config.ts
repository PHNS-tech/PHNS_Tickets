"server only"

import { PinataSDK } from "pinata"

// Pinata SDK instance for file uploads
export const pinata = new PinataSDK({
    pinataJwt: `${process.env.PINATA_JWT}`,
    pinataGateway: `${process.env.NEXT_PUBLIC_GATEWAY_URL}`
})
