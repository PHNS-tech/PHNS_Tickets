import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        console.log('[/api/upload] Receiving file upload');
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const url = formData.get("url") as string;

        console.log('[/api/upload] File:', file?.name, 'Size:', file?.size, 'URL present:', !!url);

        if (!file || !url) {
            console.error('[/api/upload] Missing file or URL', { file: !!file, url: !!url });
            return NextResponse.json(
                { error: "Missing file or upload URL" },
                { status: 400 }
            );
        }

        // Initialize Pinata SDK
        const jwtToken = process.env.PINATA_JWT;
        const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL;

        if (!jwtToken || !gatewayUrl) {
            console.error('[/api/upload] Missing Pinata credentials');
            return NextResponse.json(
                { error: "Missing Pinata configuration" },
                { status: 500 }
            );
        }

        console.log('[/api/upload] Initializing Pinata SDK...');
        const pinata = new PinataSDK({
            pinataJwt: jwtToken,
            pinataGateway: gatewayUrl
        });

        // Upload file to Pinata using the signed URL (server-side, no CORS)
        console.log('[/api/upload] Uploading to Pinata...');
        const upload = await pinata.upload.public.file(file).url(url);

        console.log('[/api/upload] Upload success, CID:', upload.cid);
        return NextResponse.json(
            { cid: upload.cid },
            { status: 200 }
        );
    } catch (error) {
        console.error('[/api/upload] Upload error:', error);
        return NextResponse.json(
            { error: "Upload failed", details: String(error) },
            { status: 500 }
        );
    }
}
