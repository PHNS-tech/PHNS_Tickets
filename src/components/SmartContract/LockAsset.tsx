"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@meshsdk/react';
import {
    applyParamsToScript,
    mConStr0,
    MeshTxBuilder,
    PlutusScript,
    serializePlutusScript,
    stringToHex
} from '@meshsdk/core';
import blueprint from '../../../plutus.json';

export default function LockAsset() {
    const { wallet, connected } = useWallet();
    const [loading, setLoading] = useState(false);
    const [scriptAddress, setScriptAddress] = useState('');

    const [datum, setdatum] = useState('123');
    const [unit, setUnit] = useState('lovelace');
    const [quantity, setQuantity] = useState('2000000');
    const [result, setResult] = useState('');

    // Lấy compiled code từ plutus.json
    const Script = applyParamsToScript(
        blueprint.validators[0].compiledCode,
        []
    );

    // Tự động tạo script address khi component load
    useEffect(() => {
        const script: PlutusScript = {
            code: Script,
            version: "V3",
        };
        const { address: scriptAddr } = serializePlutusScript(script);
        setScriptAddress(scriptAddr);
    }, [Script]);

    const handleLock = async () => {
        if (!connected || !wallet) {
            setResult('Vui lòng kết nối ví trước');
            return;
        }

        if (!datum || !unit || !quantity) {
            setResult('Vui lòng điền đầy đủ thông tin');
            return;
        }

        try {
            setResult('Đang lock...');
            setLoading(true);

            const utxos = await wallet.getUtxos();
            const changeAddress = await wallet.getChangeAddress();

            const script: PlutusScript = {
                code: Script,
                version: "V3",
            };
            const { address: scriptAddress } = serializePlutusScript(script);

            const txBuilder = new MeshTxBuilder({
                verbose: true,
            });

            const unsignedTx = await txBuilder
                .txOut(scriptAddress, [{ unit, quantity }])
                .txOutInlineDatumValue(mConStr0([stringToHex(datum)]))
                .changeAddress(changeAddress)
                .selectUtxosFrom(utxos)
                .complete();

            const signedTx = await wallet.signTx(unsignedTx);
            const txHash = await wallet.submitTx(signedTx);

            setResult(`Hash: ${txHash}`);
        } catch (err) {
            setResult(`Lỗi: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', border: '1px solid #ddd', margin: '20px 0' }}>
            <h3>Lock Asset</h3>

            <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    datum:
                </label>
                <input
                    type="text"
                    value={datum}
                    onChange={(e) => setdatum(e.target.value)}
                    placeholder="datum để unlock"
                    style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                    disabled={loading}
                />

                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Unit:
                </label>
                <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="lovelace hoặc token ID"
                    style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                    disabled={loading}
                />

                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Quantity:
                </label>
                <input
                    type="text"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Số lượng"
                    style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                    disabled={loading}
                />
            </div>

            <button
                onClick={handleLock}
                disabled={loading || !connected}
                style={{
                    width: '100%',
                    padding: '10px',
                    background: !connected ? '#ccc' : loading ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    cursor: !connected || loading ? 'not-allowed' : 'pointer'
                }}
            >
                {!connected ? 'Chưa kết nối ví' : loading ? 'Đang xử lý...' : 'Lock'}
            </button>

            {result && <p style={{ marginTop: '10px' }}>{result}</p>}

            {scriptAddress && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                    Script Address: {scriptAddress}
                </div>
            )}
        </div>
    );
}