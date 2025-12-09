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
    const [file, setFile] = useState<File>();
    const [uploading, setUploading] = useState(false);
    const [ipfsHash, setIpfsHash] = useState('');

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

    const uploadFile = async () => {
        if (!file) return alert('No file selected');
        try {
            setUploading(true);
            // Get signed upload URL from backend
            const urlRes = await fetch('/api/url').then((res) => res.json());

            // Upload file to Pinata via backend API route (avoids CORS)
            const formData = new FormData();
            formData.append('file', file);
            formData.append('url', urlRes.url);

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            }).then((res) => res.json());

            if (uploadRes.cid) {
                setIpfsHash(uploadRes.cid);
                setUploading(false);
                alert('Image uploaded! Ready to create ticket.');
            } else {
                throw new Error(uploadRes.error || 'Unknown error');
            }
        } catch (e) {
            console.log(e);
            setUploading(false);
            alert('Upload failed');
        }
    };

    const handleCreate = async (e: any) => {
        e.preventDefault();
        if (!connected || !wallet) return setMessage('Please connect your wallet');

        const form = new FormData(e.target);
        const eventId = String(form.get('eventId') || '');
        const ticketNumber = String(form.get('ticketNumber') || '');
        const priceAda = Number(form.get('price') || 0);
        if (!eventId || !ticketNumber || !priceAda) return setMessage('Please fill all fields');
        if (!ipfsHash) return setMessage('Please upload an image first');

        try {
            setMessage('Building transaction...');

            const utxos = await wallet.getUtxos();
            const changeAddress = await wallet.getChangeAddress();

            // datum: pack ticket info + image hash into the inline datum
            const datumStr = JSON.stringify({
                eventId,
                seller: address ?? '',
                price: priceAda,
                ticketNumber,
                eventDate: Date.now(),
                status: 0,
                imageHash: ipfsHash  // Include IPFS hash
            });

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

            <div style={{ marginBottom: 20, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
                <h3>Upload Ticket Image</h3>
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0])}
                    style={{ marginBottom: 8, display: 'block', width: '100%' }}
                />
                {file && (
                    <div style={{ marginBottom: 8 }}>
                        <img
                            src={URL.createObjectURL(file)}
                            alt="preview"
                            style={{ maxWidth: 150, borderRadius: 4 }}
                        />
                    </div>
                )}
                <button
                    type="button"
                    disabled={uploading || !file}
                    onClick={uploadFile}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: uploading || !file ? '#ccc' : '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: uploading || !file ? 'not-allowed' : 'pointer',
                        width: '100%'
                    }}
                >
                    {uploading ? 'Uploading...' : 'Upload to Pinata'}
                </button>
                {ipfsHash && <p style={{ color: 'green', fontSize: 12, marginTop: 8 }}>✓ Image uploaded: {ipfsHash}</p>}
            </div>

            <form onSubmit={handleCreate} style={{ display: 'grid', gap: 8, maxWidth: 500 }}>
                <input name="eventId" placeholder="Event ID" />
                <input name="ticketNumber" placeholder="Ticket Serial" />
                <input name="price" placeholder="Price (ADA)" />
                <button type="submit" disabled={!ipfsHash}>Create Ticket</button>
            </form>
            {scriptAddress && <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Script: {scriptAddress}</div>}
            {message && <p style={{ marginTop: 12, padding: 8, backgroundColor: '#f0f0f0', borderRadius: 4 }}>{message}</p>}
        </div>
    );
}
