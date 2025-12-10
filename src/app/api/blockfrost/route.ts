import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';


// Định nghĩa cấu trúc dữ liệu UTXO trả về
interface ProcessedUTXO {
    txHash: string;
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

            if (utxo.data_hash) {
                try {
                    const datumResponse = await axios.get(`${blockfrostURL}/scripts/datum/${utxo.data_hash}`, { headers });
                    datumValue = datumResponse.data.json_value;
                } catch (err) {
                    datumValue = { error: 'Không thể lấy datum' };
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
