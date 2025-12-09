'use client';

import { useAddress, useWallet } from '@meshsdk/react';
import { useEffect, useState } from 'react';
import {
    applyParamsToScript,
    MeshTxBuilder,
    serializePlutusScript,
    mConStr0,
    stringToHex,
} from '@meshsdk/core';
import blueprint from '../../../plutus.json';
import { provider } from '../../utils/config';

export default function Marketplace() {
    const address = useAddress();
    const { wallet, connected } = useWallet();
    const [tickets, setTickets] = useState<any[]>([]);
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

    // fetch available UTXOs from script address (requires Blockfrost key in env)
    useEffect(() => {
        async function load() {
            if (!scriptAddress) return;
            try {
                const res = await fetch('/api/blockfrost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: scriptAddress }) });
                const json = await res.json();
                if (!json.success) {
                    console.error('Blockfrost API error', json.error);
                    return;
                }

                const utxos = json.data;
                const found = utxos.map((u: any, i: number) => ({
                    id: `${u.txHash}_${i}`,
                    txHash: u.txHash,
                    outputIndex: 0,
                    amount: u.assets,
                    eventName: `Ticket ${i + 1}`,
                    price: (u.assets.find((a: any) => a.unit === 'lovelace')?.quantity || 0) / 1_000_000,
                    raw: u,
                }));
                setTickets(found);
            } catch (err) {
                console.error('Failed to load script UTxOs', err);
            }
        }
        load();
    }, [scriptAddress]);

    const buy = async (t: any) => {
        if (!connected || !wallet) { alert('Connect wallet'); return }

        try {
            const walletUtxos = await wallet.getUtxos();
            const changeAddress = await wallet.getChangeAddress();

            // Build spending tx for the first matching UTXO
            const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });

            // Use a simple string redeemer containing buyer address
            const redeemerStr = JSON.stringify({ action: 'buy', buyer: address });

            await txBuilder
                .spendingPlutusScriptV3()
                .txIn(
                    t.raw.input.txHash,
                    t.raw.input.outputIndex,
                    t.raw.output.amount,
                    scriptAddress
                )
                .txInScript(Script)
                .txInRedeemerValue(mConStr0([stringToHex(redeemerStr)]))
                .txInInlineDatumPresent()
                .changeAddress(changeAddress)
                .txInCollateral(
                    // use first collateral UTXO from wallet if available
                    ...(await (async () => {
                        const coll = await wallet.getCollateral();
                        if (!coll || coll.length === 0) return [];
                        const c = coll[0];
                        return [c.input.txHash, c.input.outputIndex, c.output.amount, c.output.address];
                    })())
                )
                .selectUtxosFrom(walletUtxos)
                .complete();

            const unsigned = txBuilder.txHex;
            const signed = await wallet.signTx(unsigned);
            const txHash = await wallet.submitTx(signed);

            alert('Bought tx=' + txHash);
        } catch (err) {
            console.error(err);
            alert('Error: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    return (
        <div style={{ padding: 20 }}>
            <h2>Marketplace</h2>
            {tickets.length === 0 && <div>No tickets found on script address (or missing Blockfrost key)</div>}
            {tickets.map(t => (
                <div key={t.id} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 8 }}>
                    <div>{t.eventName} — {t.price} ADA</div>
                    <button onClick={() => buy(t)}>Buy</button>
                </div>
            ))}
        </div>
    )
}
