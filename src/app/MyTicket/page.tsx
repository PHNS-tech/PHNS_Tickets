"use client";

import { useEffect, useState } from 'react';
import { useWallet, useAddress } from '@meshsdk/react';
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
    return `https://gateway.pinata.cloud/ipfs/${image}`;
}

export default function MyTicketPage() {
    const { wallet, connected } = useWallet();
    const address = useAddress();
    const [scriptAddress, setScriptAddress] = useState('');
    const [myTickets, setMyTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');

    const Script = applyParamsToScript(blueprint.validators[0].compiledCode, []);

    useEffect(() => {
        const { address: addr } = serializePlutusScript({ code: Script, version: 'V3' });
        setScriptAddress(addr);
    }, [Script]);

    const loadMyTickets = async () => {
        if (!scriptAddress || !address) return;
        const data = await fetchUtxos(scriptAddress);
        const processed = (data || []).map((u: any) => {
            const assets = Array.isArray(u.amount) ? u.amount.filter((a: any) => a.unit !== 'lovelace') : [];
            let datumParsed: any = null;
            try {
                if (u.datum && typeof u.datum === 'object') {
                    if (u.datum.cbor) {
                        const s = hexToString(u.datum.cbor);
                        datumParsed = JSON.parse(s);
                    } else if (u.datum.fields && u.datum.fields[0] && u.datum.fields[0].bytes) {
                        const hex = u.datum.fields[0].bytes;
                        const s = hexToString(hex);
                        try { datumParsed = JSON.parse(s); } catch (e) { datumParsed = s; }
                    }
                }
            } catch (err) {
                datumParsed = null;
            }
            return { ...u, assets, datumParsed };
        });
        // Filter tickets where seller matches current address and status == 1 (unlocked)
        const my = processed.filter((u: any) => u.datumParsed?.seller === address && u.datumParsed?.status === 1);
        setMyTickets(my);
    };

    useEffect(() => { loadMyTickets(); }, [scriptAddress, address]);

    const handleBurn = async (utxo: any) => {
        if (!connected || !wallet) return alert("Connect wallet first");
        try {
            setLoading(true);
            const blockfrost = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY!);
            const contract = new Contract({ wallet: wallet as any, blockfrostProvider: blockfrost });
            const txHash = await contract.burnAsset({ txHash: utxo.input.txHash });
            setResult(`Burned: ${txHash}`);
            loadMyTickets(); // reload
        } catch (e) {
            console.error(e);
            setResult('Burn failed');
        } finally {
            setLoading(false);
        }
    };

    const handleRelock = async (utxo: any) => {
        if (!connected || !wallet) return alert("Connect wallet first");
        try {
            setLoading(true);
            const blockfrost = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY!);
            const contract = new Contract({ wallet: wallet as any, blockfrostProvider: blockfrost });
            const newDatum = JSON.stringify({ ...utxo.datumParsed, status: 0 });
            const txHash = await contract.relockAsset({ txHash: utxo.input.txHash, newDatum });
            setResult(`Relocked: ${txHash}`);
            loadMyTickets(); // reload
        } catch (e) {
            console.error(e);
            setResult('Relock failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main style={{
            width: '100%',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '24px',
            padding: '32px'
        }}>
            <h1 style={{ fontSize: '30px', fontWeight: 'bold' }}>
                My Tickets
            </h1>

            {!connected && <p>Please connect your wallet to view your tickets.</p>}

            {connected && (
                <div style={{ width: '100%', maxWidth: '800px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p>Script address: {scriptAddress}</p>
                        <button onClick={loadMyTickets} style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Reload</button>
                    </div>

                    {myTickets.length === 0 && <p>No unlocked tickets found.</p>}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                        {myTickets.map((u, i) => {
                            const asset = u.assets?.[0];
                            let tokenName = '';
                            if (asset && asset.unit && asset.unit !== 'lovelace') {
                                const unit = asset.unit;
                                const policyLen = 56;
                                const tokenHex = unit.length > policyLen ? unit.slice(policyLen) : '';
                                tokenName = tokenHex ? hexToString(tokenHex) : unit;
                            }

                            return (
                                <div key={i} style={{ border: '1px solid #e6e6e6', borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                                    <div style={{ height: 140, background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ textAlign: 'center', color: '#999' }}>
                                            <div style={{ fontSize: 12 }}>Ticket</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{tokenName || (asset ? asset.unit.substring(0, 12) + '...' : '—')}</div>
                                        </div>
                                    </div>

                                    <div style={{ padding: 12 }}>
                                        <div style={{ fontWeight: 700 }}>Ticket #{i + 1}</div>
                                        <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                                            <div>TX: {u.input.txHash.substring(0, 16)}...</div>
                                            <div>Status: Unlocked</div>
                                        </div>

                                        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                            <button onClick={() => handleBurn(u)} disabled={loading} style={{ flex: 1, padding: 10, background: loading ? '#ccc' : '#dc3545', color: 'white', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}>Burn</button>
                                            <button onClick={() => handleRelock(u)} disabled={loading} style={{ flex: 1, padding: 10, background: loading ? '#ccc' : '#17a2b8', color: 'white', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}>Relock</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {result && <div style={{ marginTop: 12, padding: 10, background: '#e7f3ff', borderRadius: 6, fontSize: 13 }}>{result}</div>}
                </div>
            )}
        </main>
    );
}