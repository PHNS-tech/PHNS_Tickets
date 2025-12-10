import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Server side Blockfrost proxy to fetch utxos for an address
// Requires environment variable: BLOCKFROST_API_KEY (server-only)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

    const key = process.env.BLOCKFROST_API_KEY || process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY;
    if (!key) return NextResponse.json({ error: "Blockfrost key not configured" }, { status: 500 });

    const res = await fetch(`https://cardano-preprod.blockfrost.io/api/v0/addresses/${encodeURIComponent(address)}/utxos`, {
      headers: {
        project_id: key,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const utxos = await res.json();
    return NextResponse.json({ utxos });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
