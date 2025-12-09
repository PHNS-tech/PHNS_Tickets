import { NextRequest, NextResponse } from "next/server";
import { pinata } from "../../../utils/pinata-config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const url = formData.get("url") as string;

        if (!file || !url) {
            return NextResponse.json(
                { error: "Missing file or upload URL" },
                { status: 400 }
            );
        }

        // Upload file to Pinata using the signed URL (server-side, no CORS)
        const upload = await pinata.upload.public.file(file).url(url);

        return NextResponse.json(
            { cid: upload.cid },
            { status: 200 }
        );
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Upload failed" },
            { status: 500 }
        );
    }
}
