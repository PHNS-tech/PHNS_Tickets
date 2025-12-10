import { NextResponse } from "next/server";
import { PinataSDK } from "pinata";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log('[/api/url] Creating signed URL for Pinata upload');

    // Get environment variables
    const jwtToken = process.env.PINATA_JWT;
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL;

    console.log('[/api/url] JWT present:', !!jwtToken);
    console.log('[/api/url] Gateway URL:', gatewayUrl);

    if (!jwtToken) {
      console.error('[/api/url] PINATA_JWT is missing');
      return NextResponse.json(
        { error: 'PINATA_JWT environment variable is not set' },
        { status: 500 }
      );
    }
    if (!gatewayUrl) {
      console.error('[/api/url] NEXT_PUBLIC_GATEWAY_URL is missing');
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_GATEWAY_URL environment variable is not set' },
        { status: 500 }
      );
    }

    console.log('[/api/url] Initializing Pinata SDK...');
    const pinata = new PinataSDK({
      pinataJwt: jwtToken,
      pinataGateway: gatewayUrl
    });

    console.log('[/api/url] Calling pinata.upload.public.createSignedURL...');
    const url = await pinata.upload.public.createSignedURL({
      expires: 30,
    })
    console.log('[/api/url] Success:', url);
    return NextResponse.json({ url: url }, { status: 200 });
  } catch (error) {
    console.error('[/api/url] Caught error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[/api/url] Error message:', errorMsg);
    return NextResponse.json(
      { error: "Error creating signed URL", message: errorMsg },
      { status: 500 }
    );
  }
}