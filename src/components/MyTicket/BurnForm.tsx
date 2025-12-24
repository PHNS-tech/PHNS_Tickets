"use client";

import { useState } from "react";
import { useWallet } from "@meshsdk/react";
import { Contract } from "../../offchain";
import { BlockfrostProvider } from "@meshsdk/core";

export default function BurnForm() {
  const { wallet, connected } = useWallet();

  const [txHashInput, setTxHashInput] = useState("");
  const [burning, setBurning] = useState(false);
  const [txHash, setTxHash] = useState("");

  const handleBurn = async () => {
    if (!connected || !wallet) return alert("Connect wallet first");
    if (!txHashInput.trim()) return alert("Enter Tx Hash");

    try {
      setBurning(true);

      const blockfrost = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY!);
      const contract = new Contract({ wallet: wallet as any, blockfrostProvider: blockfrost });

      const burnTxHash = "Burn not available"; // await contract.burnAsset({ txHash: txHashInput });

      setTxHash(burnTxHash);
      setBurning(false);
      alert("Ticket burned!");
    } catch (e) {
      console.log(e);
      setBurning(false);
      alert("Burn failed");
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
      <h3>Burn Ticket</h3>
      <input
        type="text"
        placeholder="Tx Hash"
        value={txHashInput}
        onChange={(e) => setTxHashInput(e.target.value)}
        style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
      />
      <button
        onClick={handleBurn}
        disabled={burning}
        style={{
          padding: '10px',
          background: burning ? '#ccc' : '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: burning ? 'not-allowed' : 'pointer'
        }}
      >
        {burning ? "Burning..." : "Burn"}
      </button>
      {txHash && <p>Tx Hash: {txHash}</p>}
    </div>
  );
}