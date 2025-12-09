import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        if (!body.ticketUtxo || !body.buyer) return NextResponse.json({ error: 'missing fields' }, { status: 400 });
        return NextResponse.json({ success: true, transactionHash: `tx_buy_${Date.now()}` });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
    }
}
