"use client";

import { useEffect, useState } from 'react';
import { useWallet } from '@meshsdk/react';
import {
    applyParamsToScript,
    serializePlutusScript,
    MeshTxBuilder,
    mConStr0,
    stringToHex,
} from '@meshsdk/core';
import blueprint from '../../../plutus.json';

async function fetchUtxos(address: string) {
    const res = await fetch('/api/blockfrost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
    });
    const json = await res.json();
    return json.success ? json.data : [];
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
        setUtxos(data || []);
    };

    useEffect(() => { load(); }, [scriptAddress]);

    // Unlock: spend script UTxO and transfer token to buyer
    const handleUnlock = async () => {
        if (!connected || !wallet) return alert('Connect wallet first');
        if (!selectedUtxo) return alert('Select a listing');
        try {
            setLoading(true);
            setResult('Building unlock tx...');

            const buyerAddr = await wallet.getChangeAddress();
            const walletUtxos = await wallet.getUtxos();
            const collateral = await wallet.getCollateral();

            const asset = selectedUtxo.assets?.[0];
            if (!asset) throw new Error('No asset in UTxO');

            const redeemerObj = { action: 1, buyer: buyerAddr, new_price: null, quantity: Number(asset.quantity) };
            const redeemerStr = JSON.stringify(redeemerObj);

            const txBuilder = new MeshTxBuilder({ verbose: true });

            const unsigned = await txBuilder
                .spendingPlutusScriptV3()
                .txIn(
                    selectedUtxo.input.txHash,
                    selectedUtxo.input.outputIndex,
                    selectedUtxo.output.amount,
                    scriptAddress
                )
                .txInScript(Script)
                .txInRedeemerValue(mConStr0([stringToHex(redeemerStr)]))
                .txInInlineDatumPresent()
                .txOut(buyerAddr, [
                    { unit: 'lovelace', quantity: '2000000' },
                    { unit: asset.unit, quantity: String(asset.quantity) },
                ])
                .changeAddress(buyerAddr)
                .txInCollateral(
                    collateral[0].input.txHash,
                    collateral[0].input.outputIndex,
                    collateral[0].output.amount,
                    collateral[0].output.address
                )
                .selectUtxosFrom(walletUtxos)
                .complete();

            const signed = await wallet.signTx(unsigned);
            const txHash = await wallet.submitTx(signed);

            setResult('Unlocked! Tx: ' + txHash);
            setSelectedUtxo(null);
            setSelectedAction(null);
            await load();
        } catch (err) {
            console.error(err);
            setResult('Unlock failed: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setLoading(false);
        }
    };

    // Re-lock: unlock from script and re-lock to buyer's address
    const handleReLock = async () => {
        if (!connected || !wallet) return alert('Connect wallet first');
        if (!selectedUtxo) return alert('Select a listing');
        try {
            setLoading(true);
            setResult('Building re-lock tx...');

            const buyerAddr = await wallet.getChangeAddress();
            const walletUtxos = await wallet.getUtxos();
            const collateral = await wallet.getCollateral();

            const asset = selectedUtxo.assets?.[0];
            if (!asset) throw new Error('No asset in UTxO');

            const redeemerObj = { action: 1, buyer: buyerAddr, new_price: null, quantity: Number(asset.quantity) };
            const redeemerStr = JSON.stringify(redeemerObj);

            // New datum for re-lock (buyer becomes seller)
            const newDatumObj = { event_id: 'evt1', seller: buyerAddr, price: 2000000, ticket_number: 't1', event_date: 0, status: 0 };
            const newDatumStr = JSON.stringify(newDatumObj);

            const txBuilder = new MeshTxBuilder({ verbose: true });

            const unsigned = await txBuilder
                .spendingPlutusScriptV3()
                .txIn(
                    selectedUtxo.input.txHash,
                    selectedUtxo.input.outputIndex,
                    selectedUtxo.output.amount,
                    scriptAddress
                )
                .txInScript(Script)
                .txInRedeemerValue(mConStr0([stringToHex(redeemerStr)]))
                .txInInlineDatumPresent()
                // re-lock to script with new datum
                .txOut(scriptAddress, [{ unit: asset.unit, quantity: String(asset.quantity) }])
                .txOutInlineDatumValue(mConStr0([stringToHex(newDatumStr)]))
                .changeAddress(buyerAddr)
                .txInCollateral(
                    collateral[0].input.txHash,
                    collateral[0].input.outputIndex,
                    collateral[0].output.amount,
                    collateral[0].output.address
                )
                .selectUtxosFrom(walletUtxos)
                .complete();

            const signed = await wallet.signTx(unsigned);
            const txHash = await wallet.submitTx(signed);

            setResult('Re-locked! Tx: ' + txHash);
            setSelectedUtxo(null);
            setSelectedAction(null);
            await load();
        } catch (err) {
            console.error(err);
            setResult('Re-lock failed: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setLoading(false);
        }
    };

    // Burn: unlock and discard (send to burn address)
    const handleBurn = async () => {
        if (!connected || !wallet) return alert('Connect wallet first');
        if (!selectedUtxo) return alert('Select a listing');
        try {
            setLoading(true);
            setResult('Building burn tx...');

            const buyerAddr = await wallet.getChangeAddress();
            const walletUtxos = await wallet.getUtxos();
            const collateral = await wallet.getCollateral();

            const asset = selectedUtxo.assets?.[0];
            if (!asset) throw new Error('No asset in UTxO');

            const redeemerObj = { action: 2, buyer: buyerAddr, new_price: null, quantity: Number(asset.quantity) };
            const redeemerStr = JSON.stringify(redeemerObj);

            // Burn address: send to a burn address (e.g., stake address with no spendable path)
            const burnAddr = 'addr_test1vrm9z2r8ff0kscqvvr7manlruezc461smvl6glj50n3drtcg8pfck';

            const txBuilder = new MeshTxBuilder({ verbose: true });

            const unsigned = await txBuilder
                .spendingPlutusScriptV3()
                .txIn(
                    selectedUtxo.input.txHash,
                    selectedUtxo.input.outputIndex,
                    selectedUtxo.output.amount,
                    scriptAddress
                )
                .txInScript(Script)
                .txInRedeemerValue(mConStr0([stringToHex(redeemerStr)]))
                .txInInlineDatumPresent()
                // send to burn address
                .txOut(burnAddr, [
                    { unit: 'lovelace', quantity: '2000000' },
                    { unit: asset.unit, quantity: String(asset.quantity) },
                ])
                .changeAddress(buyerAddr)
                .txInCollateral(
                    collateral[0].input.txHash,
                    collateral[0].input.outputIndex,
                    collateral[0].output.amount,
                    collateral[0].output.address
                )
                .selectUtxosFrom(walletUtxos)
                .complete();

            const signed = await wallet.signTx(unsigned);
            const txHash = await wallet.submitTx(signed);

            setResult('Burned! Tx: ' + txHash);
            setSelectedUtxo(null);
            setSelectedAction(null);
            await load();
        } catch (err) {
            console.error(err);
            setResult('Burn failed: ' + (err instanceof Error ? err.message : String(err)));
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
                        if (u.datum && typeof u.datum === 'object') {
                            price = u.datum.price || u.datum.cbor;
                        }
                    } catch (e) { }
                    const asset = u.assets?.[0];

                    return (
                        <div key={i} style={{ border: isSelected ? '2px solid #007bff' : '1px solid #e6e6e6', borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                            <div style={{ height: 140, background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {/* If datum contains image cid you can render it here. For now show placeholder */}
                                <div style={{ textAlign: 'center', color: '#999' }}>
                                    <div style={{ fontSize: 12 }}>Ticket</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{asset ? asset.unit.substring(0, 12) + '...' : '—'}</div>
                                </div>
                            </div>

                            <div style={{ padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontWeight: 700 }}>Listing #{i + 1}</div>
                                    <div style={{ fontSize: 12, color: '#666' }}>{asset ? `${asset.quantity}` : ''}</div>
                                </div>

                                <div style={{ marginTop: 8, fontSize: 13, color: '#444' }}>
                                    <div style={{ marginBottom: 6 }}><strong>TX:</strong> {u.input.txHash.substring(0, 16)}...</div>
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
                        <button onClick={selectedAction === 'unlock' ? handleUnlock : selectedAction === 'relock' ? handleReLock : handleBurn} disabled={loading} style={{ flex: 1, padding: 12, background: loading ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Processing...' : 'Confirm'}</button>
                        <button onClick={() => { setSelectedUtxo(null); setSelectedAction(null); }} style={{ flex: 1, padding: 12, background: '#ddd', color: '#333', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                    </div>
                </div>
            )}

            {result && <div style={{ marginTop: 12, padding: 10, background: '#e7f3ff', borderRadius: 6, fontSize: 13 }}>{result}</div>}
        </div>
    );
}
