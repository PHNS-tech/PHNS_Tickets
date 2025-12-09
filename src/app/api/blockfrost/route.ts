import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface ProcessedUTXO {
    txHash: string;
    assets: Array<{ unit: string; quantity: string }>;
    datum: any;
}

export async function POST(request: NextRequest) {
    try {
        const { address } = await request.json();

        if (!address) {
            return NextResponse.json({ error: 'Missing address' }, { status: 400 });
        }

        const blockfrostURL = process.env.NEXT_PUBLIC_BLOCKFROST_GATEWAY || 'https://cardano-preprod.blockfrost.io/api/v0';
        const headers = {
            project_id: process.env.BLOCKFROST_API_KEY || process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY || ''
        } as any;

        const response = await axios.get(`${blockfrostURL}/addresses/${address}/utxos`, { headers });
        const utxos = response.data;

        const result: ProcessedUTXO[] = [];

        for (const utxo of utxos) {
            let datumValue = null;

            if (utxo.data_hash) {
                try {
                    const datumResponse = await axios.get(`${blockfrostURL}/scripts/datum/${utxo.data_hash}`, { headers });
                    datumValue = datumResponse.data.json_value;
                } catch (err) {
                    datumValue = { error: 'Failed to fetch datum' };
                }
            } else if (utxo.inline_datum) {
                datumValue = { cbor: utxo.inline_datum };
            }

            result.push({
                txHash: utxo.tx_hash,
                assets: utxo.amount,
                datum: datumValue
            });
        }

        return NextResponse.json({ success: true, data: result, total: result.length });
    } catch (error) {
        console.error('Blockfrost API error', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch blockchain data' }, { status: 500 });
    }
}
