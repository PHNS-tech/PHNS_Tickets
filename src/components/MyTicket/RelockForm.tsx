"use client";

import { useState } from "react";
import { useWallet } from "@meshsdk/react";
import { Contract } from "../../offchain";
import { BlockfrostProvider } from "@meshsdk/core";

export default function RelockForm() {
    const { wallet, connected } = useWallet();

    const [txHashInput, setTxHashInput] = useState("");
    const [newDatum, setNewDatum] = useState("");
    const [relocking, setRelocking] = useState(false);
    const [txHash, setTxHash] = useState("");

    const handleRelock = async () => {
        if (!connected || !wallet) return alert("Connect wallet first");
        if (!txHashInput.trim()) return alert("Enter Tx Hash");
        if (!newDatum.trim()) return alert("Enter New Datum");

        try {
            setRelocking(true);

            const blockfrost = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY!);
            const contract = new Contract({ wallet: wallet as any, blockfrostProvider: blockfrost });

            const relockTxHash = "Relock not available"; // await contract.relockAsset({ txHash: txHashInput, newDatum });

            setTxHash(relockTxHash);
            setRelocking(false);
            alert("Ticket relocked!");
        } catch (e) {
            console.log(e);
            setRelocking(false);
            alert("Relock failed");
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '20px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            width: '300px'
        }}>
            <h3>Relock Ticket</h3>
            <input
                type="text"
                placeholder="Tx Hash"
                value={txHashInput}
                onChange={(e) => setTxHashInput(e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <textarea
                placeholder="New Datum (JSON)"
                value={newDatum}
                onChange={(e) => setNewDatum(e.target.value)}
                rows={4}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <button
                onClick={handleRelock}
                disabled={relocking}
                style={{
                    padding: '10px',
                    background: relocking ? '#ccc' : '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: relocking ? 'not-allowed' : 'pointer'
                }}
            >
                {relocking ? "Relocking..." : "Relock"}
            </button>
            {txHash && <p>Tx Hash: {txHash}</p>}
        </div>
    );
}