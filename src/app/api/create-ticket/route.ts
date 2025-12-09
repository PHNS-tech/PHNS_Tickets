import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        if (!body.eventId || !body.seller) return NextResponse.json({ error: 'missing fields' }, { status: 400 });
        return NextResponse.json({ success: true, transactionHash: `tx_create_${Date.now()}`, ticket: body });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
    }
}
