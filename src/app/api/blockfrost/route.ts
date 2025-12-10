import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';


// Định nghĩa cấu trúc dữ liệu UTXO trả về (tương tự Mesh SDK)
interface ProcessedUTXO {
    input: {
        txHash: string;
        outputIndex: number;
    };
    output: {
        address: string;
        amount: Array<{ unit: string; quantity: string }>;
    };
    assets: Array<{ unit: string; quantity: string }>;
    datum: any;
}


export async function POST(request: NextRequest) {
    try {
        // 1. Lấy địa chỉ từ request
        const { address } = await request.json();


        // 2. Kiểm tra địa chỉ
        if (!address) {
            return NextResponse.json({ error: 'Thiếu địa chỉ ví' }, { status: 400 });
        }


        // 3. Cấu hình Blockfrost
        const blockfrostURL = process.env.NEXT_PUBLIC_BLOCKFROST_GATEWAY || '';
        const headers = {
            Project_id: process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY || ''
        };


        // 4. Lấy UTXOs từ Blockfrost
        const response = await axios.get(`${blockfrostURL}/addresses/${address}/utxos`, { headers });
        const utxos = response.data;


        // 5. Xử lý từng UTXO
        const result: ProcessedUTXO[] = [];


        for (const utxo of utxos) {
            let datumValue = null;

            console.log(`[blockfrost] Processing UTXO: ${utxo.tx_hash}#${utxo.output_index}`);
            console.log(`[blockfrost] Has data_hash: ${!!utxo.data_hash}, Has inline_datum: ${!!utxo.inline_datum}`);

            if (utxo.data_hash) {
                try {
                    const datumResponse = await axios.get(`${blockfrostURL}/scripts/datum/${utxo.data_hash}`, { headers });
                    datumValue = datumResponse.data.json_value;
                    console.log(`[blockfrost] Got datum from data_hash:`, datumValue);
                } catch (err) {
                    console.error(`[blockfrost] Error fetching datum:`, err);
                    datumValue = { error: 'Không thể lấy datum' };
                }
            } else if (utxo.inline_datum) {
                // Inline datum từ Blockfrost là hex string CBOR
                // Thử parse nó
                try {
                    // Inline datum thường là hex, cần giải mã
                    datumValue = { cbor: utxo.inline_datum, raw: utxo.inline_datum };
                    console.log(`[blockfrost] Got inline_datum (hex):`, utxo.inline_datum);
                } catch (err) {
                    datumValue = { error: 'Không thể parse inline datum' };
                }
            }


            result.push({
                input: {
                    txHash: utxo.tx_hash,
                    outputIndex: utxo.output_index
                },
                output: {
                    address: utxo.address,
                    amount: utxo.amount
                },
                assets: utxo.amount,
                datum: datumValue
            });
        }

        console.log(`[blockfrost] Returning ${result.length} UTXOs`);


        // 6. Trả về kết quả
        return NextResponse.json({
            success: true,
            data: result,
            total: result.length
        });


    } catch (error) {
        console.error('Lỗi API:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Không thể lấy dữ liệu blockchain'
            },
            { status: 500 }
        );
    }
}
