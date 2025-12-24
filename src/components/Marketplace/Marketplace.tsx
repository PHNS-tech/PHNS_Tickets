"use client";

import { useEffect, useState } from 'react';
import { useWallet } from '@meshsdk/react';
import { Contract } from '../../offchain';
import { BlockfrostProvider, applyParamsToScript, serializePlutusScript } from '@meshsdk/core';
import blueprint from '../../../aiken-marketplace/plutus.json';

async function fetchUtxos(address: string) {
    const res = await fetch('/api/blockfrost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
    });
    const json = await res.json();
    return json.success ? json.data : [];
}

function hexToString(hex: string) {
    try {
        if (!hex) return '';
        // loại bỏ 0x nếu có
        if (hex.startsWith('0x')) hex = hex.slice(2);
        const bytes = hex.match(/.{1,2}/g) || [];
        return bytes.map(b => String.fromCharCode(parseInt(b, 16))).join('');
    } catch (e) {
        return '';
    }
}

function normalizeImageUrl(image: string) {
    if (!image) return null;
    if (image.startsWith('http')) return image;
    if (image.startsWith('ipfs://')) {
        const hash = image.slice(7);
        return `https://gateway.pinata.cloud/ipfs/${hash}`;
    }
    // Giả sử đây là hash IPFS
    return `https://gateway.pinata.cloud/ipfs/${image}`;
}

export default function Marketplace() {
    const { wallet, connected } = useWallet();
    const [scriptAddress, setScriptAddress] = useState('');
    const [utxos, setUtxos] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [selectedAction, setSelectedAction] = useState<string | null>(null);
    const [selectedUtxo, setSelectedUtxo] = useState<any>(null);

    const Script = applyParamsToScript(blueprint.validators[0].compiledCode, []);

    useEffect(() => {
        const { address } = serializePlutusScript({ code: Script, version: 'V3' });
        setScriptAddress(address);
    }, [Script]);

    const load = async () => {
        if (!scriptAddress) return;
        console.log('[Marketplace] Loading UTXOs from script address:', scriptAddress);
        const data = await fetchUtxos(scriptAddress);
        console.log('[Marketplace] Got UTXOs:', data);
        // Chuẩn hóa UTXOs: lọc tài sản token, giải mã byte datum (hex -> JSON)
        const processed = (data || []).map((u: any) => {
            // tài sản: tất cả token không phải lovelace trong mảng amount
            const rawAmounts = u.amount || u.assets || [];
            const assets = Array.isArray(rawAmounts) ? rawAmounts.filter((a: any) => a.unit !== 'lovelace') : [];

            // giải mã datum nếu có (Blockfrost cung cấp fields[0].bytes là hex của chuỗi JSON)
            let datumParsed: any = null;
            try {
                if (u.datum && typeof u.datum === 'object') {
                    // trước đây chúng ta đôi khi nhận { cbor: hex } hoặc { fields: [{ bytes: '...'}] }
                    if (u.datum.cbor) {
                        const s = hexToString(u.datum.cbor);
                        datumParsed = JSON.parse(s);
                    } else if (u.datum.fields && u.datum.fields[0] && u.datum.fields[0].bytes) {
                        const hex = u.datum.fields[0].bytes;
                        const s = hexToString(hex);
                        try { datumParsed = JSON.parse(s); } catch (e) { datumParsed = s; }
                    } else {
                        datumParsed = u.datum;
                    }
                }
            } catch (err) {
                console.warn('[Marketplace] Failed to parse datum for utxo', u.input?.txHash, err);
                datumParsed = null;
            }

            return {
                ...u,
                assets,
                datumParsed,
            };
        });

        setUtxos(processed || []);
    };

    useEffect(() => { load(); }, [scriptAddress]);

    const handleUnlock = async () => {
        if (!selectedUtxo || !connected || !wallet) return;
        try {
            const blockfrost = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY!);
            const contract = new Contract({ wallet: wallet as any, blockfrostProvider: blockfrost });
            const txHash = await contract.unlockAsset({ txHash: selectedUtxo.input.txHash, redeemer: "1" }); // action 1
            setResult(`Unlocked: ${txHash}`);
            setSelectedUtxo(null);
            setSelectedAction(null);
            load(); // reload listings
        } catch (e) {
            console.error(e);
            setResult('Unlock failed');
        } finally {
            setLoading(false);
        }
    };

    const handleRelock = async () => {
        if (!selectedUtxo || !connected || !wallet) return;
        try {
            const blockfrost = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY!);
            const contract = new Contract({ wallet: wallet as any, blockfrostProvider: blockfrost });
            const newDatum = JSON.stringify({ ...selectedUtxo.datumParsed, status: 0 }); // set status to 0
            const txHash = await contract.relockAsset({ txHash: selectedUtxo.input.txHash, newDatum });
            setResult(`Relocked: ${txHash}`);
            setSelectedUtxo(null);
            setSelectedAction(null);
            load();
        } catch (e) {
            console.error(e);
            setResult('Relock failed');
        } finally {
            setLoading(false);
        }
    };

    const handleBurn = async () => {
        if (!selectedUtxo || !connected || !wallet) return;
        try {
            const blockfrost = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY!);
            const contract = new Contract({ wallet: wallet as any, blockfrostProvider: blockfrost });
            const txHash = await contract.burnAsset({ txHash: selectedUtxo.input.txHash });
            setResult(`Burned: ${txHash}`);
            setSelectedUtxo(null);
            setSelectedAction(null);
            load();
        } catch (e) {
            console.error(e);
            setResult('Burn failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                    <h2 style={{ margin: 0 }}>Marketplace</h2>
                    <p style={{ fontSize: 12, color: '#666', margin: '6px 0 0' }}>Script address: {scriptAddress}</p>
                </div>
                <div>
                    <button onClick={load} style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Reload Listings</button>
                </div>
            </div>

            {utxos.length === 0 && <p>No listings available.</p>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {utxos.map((u, i) => {
                    const isSelected = selectedUtxo?.input.txHash === u.input.txHash;
                    let price = '';
                    try {
                        if (u.datumParsed) {
                            // ưu tiên giá số trong datum
                            price = u.datumParsed.price ?? u.datumParsed.cbor ?? '';
                            // nếu datumParsed là chuỗi thì thử JSON parse
                            if (!price && typeof u.datumParsed === 'string') {
                                try { const d = JSON.parse(u.datumParsed); price = d.price ?? ''; } catch (e) { }
                            }
                        }
                    } catch (e) { }
                    const asset = u.assets?.[0];
                    // lấy tên token có thể đọc từ asset.unit (policyid + hex(tokenName))
                    let tokenName = '';
                    if (asset && asset.unit && asset.unit !== 'lovelace') {
                        const unit = asset.unit;
                        // policy id là 56 ký tự hex
                        const policyLen = 56;
                        const tokenHex = unit.length > policyLen ? unit.slice(policyLen) : '';
                        tokenName = tokenHex ? hexToString(tokenHex) : unit;
                    }

                    return (
                        <div key={i} style={{ border: isSelected ? '2px solid #007bff' : '1px solid #e6e6e6', borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                            <div style={{ height: 140, background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {/* Nếu datum chứa cid ảnh bạn có thể render ở đây. Hiện tại hiển thị placeholder */}
                                <div style={{ textAlign: 'center', color: '#999' }}>
                                    {/** hiển thị ảnh nếu có trong metadata (onchain_metadata.image) hoặc datumParsed (image hoặc imageHash) */}
                                    {(() => {
                                        let imageSrc = null;
                                        if (u.metadata?.onchain_metadata?.image) {
                                            imageSrc = normalizeImageUrl(u.metadata.onchain_metadata.image);
                                        } else if (u.datumParsed?.image) {
                                            imageSrc = normalizeImageUrl(u.datumParsed.image);
                                        } else if (u.datumParsed?.imageHash) {
                                            imageSrc = `https://gateway.pinata.cloud/ipfs/${u.datumParsed.imageHash}`;
                                        }
                                        console.log('[Marketplace] Image src for', u.input?.txHash, ':', imageSrc);
                                        return imageSrc ? (
                                            <img src={imageSrc} alt={tokenName || 'ticket'} style={{ maxHeight: 120, maxWidth: '100%', objectFit: 'cover' }} onError={(e) => console.error('[Marketplace] Image load error:', imageSrc)} />
                                        ) : (
                                            <div>
                                                <div style={{ fontSize: 12 }}>Ticket</div>
                                                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{tokenName ? tokenName : (asset ? asset.unit.substring(0, 12) + '...' : '—')}</div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div style={{ padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontWeight: 700 }}>Listing #{i + 1}</div>
                                    <div style={{ fontSize: 12, color: '#666' }}>{asset ? `${asset.quantity}` : ''}</div>
                                </div>

                                <div style={{ marginTop: 8, fontSize: 13, color: '#444' }}>
                                    <div style={{ marginBottom: 6 }}><strong>TX:</strong> {u.input.txHash.substring(0, 16)}...</div>
                                    <div style={{ marginBottom: 6 }}><strong>Token:</strong> {tokenName || (asset ? asset.unit : '—')}</div>
                                    <div style={{ marginBottom: 6 }}><strong>Price:</strong> {price ? `${price} lovelace` : '—'}</div>
                                </div>

                                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                    <button onClick={() => { setSelectedUtxo(u); setSelectedAction('unlock'); }} style={{ flex: 1, padding: 10, background: selectedAction === 'unlock' && isSelected ? '#28a745' : '#f0f0f0', color: selectedAction === 'unlock' && isSelected ? 'white' : '#333', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Buy</button>
                                    <button onClick={() => { setSelectedUtxo(u); setSelectedAction('relock'); }} style={{ flex: 1, padding: 10, background: selectedAction === 'relock' && isSelected ? '#17a2b8' : '#f0f0f0', color: selectedAction === 'relock' && isSelected ? 'white' : '#333', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Re-lock</button>
                                    <button onClick={() => { setSelectedUtxo(u); setSelectedAction('burn'); }} style={{ flex: 1, padding: 10, background: selectedAction === 'burn' && isSelected ? '#dc3545' : '#f0f0f0', color: selectedAction === 'burn' && isSelected ? 'white' : '#333', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Burn</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedUtxo && selectedAction && (
                <div style={{ marginTop: 20, padding: 16, border: '1px solid #007bff', borderRadius: 8, background: '#f0f8ff' }}>
                    <h4 style={{ marginTop: 0 }}>Confirm {selectedAction.charAt(0).toUpperCase() + selectedAction.slice(1)}</h4>
                    <p style={{ fontSize: 12 }}>Selected: {selectedUtxo.input.txHash.substring(0, 20)}...</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={selectedAction === 'unlock' ? handleUnlock : selectedAction === 'relock' ? handleRelock : handleBurn} disabled={loading} style={{ flex: 1, padding: 12, background: loading ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Processing...' : 'Confirm'}</button>
                        <button onClick={() => { setSelectedUtxo(null); setSelectedAction(null); }} style={{ flex: 1, padding: 12, background: '#ddd', color: '#333', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                    </div>
                </div>
            )}

            {result && <div style={{ marginTop: 12, padding: 10, background: '#e7f3ff', borderRadius: 6, fontSize: 13 }}>{result}</div>}
        </div>
    );
}
