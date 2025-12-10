"use client";

import { useState } from "react";
import { ForgeScript, MeshTxBuilder } from "@meshsdk/core";
import { useWallet } from "@meshsdk/react";

export default function BurnForm() {
  const { wallet, connected } = useWallet();
  
  const [policyId, setPolicyId] = useState("");
  const [tokenNameHex, setTokenNameHex] = useState("");
  const [burnQuantity, setBurnQuantity] = useState(1);
  const [burning, setBurning] = useState(false);
  const [txHash, setTxHash] = useState("");

  const handleBurn = async () => {
    if (!connected || !wallet) return alert("Connect wallet first");
    if (!policyId.trim()) return alert("Enter Policy ID");
    if (!tokenNameHex.trim()) return alert("Enter Token Name Hex");
    if (burnQuantity < 1) return alert("Invalid quantity");

    try {
      setBurning(true);

      const utxos = await wallet.getUtxos();
      const changeAddress = await wallet.getChangeAddress();

      const forgingScript = ForgeScript.withOneSignature(changeAddress);

      const txBuilder = new MeshTxBuilder({ verbose: true });

      const unsignedTx = await txBuilder
        .mint(`-${burnQuantity}`, policyId, tokenNameHex)
        .mintingScript(forgingScript)
        .changeAddress(changeAddress)
        .selectUtxosFrom(utxos)
        .complete();

      const signedTx = await wallet.signTx(unsignedTx);
      const txhash = await wallet.submitTx(signedTx);
      
      setTxHash(txhash);
      setBurning(false);
      alert("Tokens burned!");
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
      gap: '16px',
      padding: '24px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      width: '100%',
      maxWidth: '400px'
    }}>
      <div>
        <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
          Policy ID:
        </label>
        <input
          type="text"
          value={policyId}
          onChange={(e) => setPolicyId(e.target.value)}
          placeholder="Enter Policy ID (56 hex characters)"
          style={{
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '16px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
          Token Name (Hex):
        </label>
        <input
          type="text"
          value={tokenNameHex}
          onChange={(e) => setTokenNameHex(e.target.value)}
          placeholder="Enter token name in hex format"
          style={{
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '16px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
          Quantity to Burn:
        </label>
        <input
          type="number"
          value={burnQuantity}
          onChange={(e) => setBurnQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          min="1"
          placeholder="Enter quantity"
          style={{
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '16px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <button 
        onClick={handleBurn}
        disabled={burning || !connected || !policyId.trim() || !tokenNameHex.trim()}
        style={{
          padding: '12px',
          backgroundColor: (burning || !connected || !policyId.trim() || !tokenNameHex.trim()) ? '#ccc' : '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '16px',
          cursor: (burning || !connected || !policyId.trim() || !tokenNameHex.trim()) ? 'not-allowed' : 'pointer'
        }}
      >
        {burning ? "Burning..." : `Burn ${burnQuantity} Token${burnQuantity > 1 ? 's' : ''}`}
      </button>

      {!connected && (
        <p style={{ color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>
          Please connect your wallet first
        </p>
      )}

      {txHash && (
        <p style={{ color: 'green', fontSize: '14px', wordBreak: 'break-all' }}>
          ✅ Success! TX: {txHash}
        </p>
      )}
    </div>
  );
}