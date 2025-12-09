'use client';

import { useAddress, useWallet } from '@meshsdk/react';
import { useState, useEffect } from 'react';
import {
    applyParamsToScript,
    mConStr0,
    MeshTxBuilder,
    serializePlutusScript,
    stringToHex,
} from '@meshsdk/core';
import blueprint from '../../../plutus.json';

export default function CreateTicket() {
    const address = useAddress();
    const { wallet, connected } = useWallet();
    const [message, setMessage] = useState('');
    const [scriptAddress, setScriptAddress] = useState('');

    // prepare script
    const Script = applyParamsToScript(blueprint.validators[0].compiledCode, []);

    useEffect(() => {
        try {
            const script = { code: Script, version: 'V3' } as any;
            const { address: addr } = serializePlutusScript(script);
            setScriptAddress(addr);
        } catch (err) {
            console.error('Failed to prepare script address', err);
        }
    }, [Script]);

    const handleCreate = async (e: any) => {
        e.preventDefault();
        if (!connected || !wallet) return setMessage('Please connect your wallet');

        const form = new FormData(e.target);
        const eventId = String(form.get('eventId') || '');
        const ticketNumber = String(form.get('ticketNumber') || '');
        const priceAda = Number(form.get('price') || 0);
        if (!eventId || !ticketNumber || !priceAda) return setMessage('Please fill all fields');

        try {
            setMessage('Building transaction...');

            const utxos = await wallet.getUtxos();
            const changeAddress = await wallet.getChangeAddress();

            // datum: we'll pack a simple JSON string into the inline datum
            const datumStr = JSON.stringify({ eventId, seller: address ?? '', price: priceAda, ticketNumber, eventDate: Date.now(), status: 0 });

            const txBuilder = new MeshTxBuilder({ verbose: true });

            const lovelace = Math.floor(priceAda * 1_000_000).toString();

            const unsignedTx = await txBuilder
                .txOut(scriptAddress, [{ unit: 'lovelace', quantity: lovelace }])
                .txOutInlineDatumValue(mConStr0([stringToHex(datumStr)]))
                .changeAddress(changeAddress)
                .selectUtxosFrom(utxos)
                .complete();

            setMessage('Waiting for wallet signature...');
            const signed = await wallet.signTx(unsignedTx);
            setMessage('Submitting transaction...');
            const txHash = await wallet.submitTx(signed);

            setMessage('Created — tx: ' + txHash);
        } catch (err) {
            console.error(err);
            setMessage('Error: ' + (err instanceof Error ? err.message : String(err)));
        }
    };

    return (
        <div style={{ padding: 20 }}>
            <h2>Create Ticket</h2>
            {!connected && <div style={{ color: 'orange' }}>Connect a wallet to create a ticket</div>}
            <form onSubmit={handleCreate} style={{ display: 'grid', gap: 8, maxWidth: 500 }}>
                <input name="eventId" placeholder="Event ID" />
                <input name="ticketNumber" placeholder="Ticket Serial" />
                <input name="price" placeholder="Price (ADA)" />
                <button type="submit">Create</button>
            </form>
            {scriptAddress && <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Script: {scriptAddress}</div>}
            {message && <p>{message}</p>}
        </div>
    );
}
