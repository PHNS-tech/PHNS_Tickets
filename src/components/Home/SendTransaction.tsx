"use client";
import { useState } from 'react';
import { useWallet } from '@meshsdk/react';
import { MeshTxBuilder } from '@meshsdk/core';

export function SendTransaction() {
  const { wallet } = useWallet();
  
  const [recipientAddress, setRecipientAddress] = useState('');
  const [unit, setUnit] = useState('lovelace');
  const [quantity, setQuantity] = useState('');
  const [result, setResult] = useState('');

  const handleSend = async () => {
    try {
      setResult('Đang gửi...');
      
      const utxos = await wallet.getUtxos();
      const changeAddress = await wallet.getChangeAddress();

      const txBuilder = new MeshTxBuilder({ verbose: true });
      const unsignedTx = await txBuilder
        .txOut(recipientAddress, [{ unit, quantity }])
        .changeAddress(changeAddress)
        .selectUtxosFrom(utxos)
        .complete();

      const signedTx = await wallet.signTx(unsignedTx);
      const txHash = await wallet.submitTx(signedTx);
      
      setResult(`Hash: ${txHash}`);
    } catch (e) {
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', margin: '20px 0' }}>
      <h3>Gửi ADA/Token</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="Địa chỉ người nhận"
          style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
        />
        
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unit (lovelace hoặc token ID)"
          style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
        />
        
        <input
          type="text"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Số lượng"
          style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
        />
      </div>

      <button 
        onClick={handleSend}
        style={{ 
          width: '100%', 
          padding: '10px', 
          background: '#007bff', 
          color: 'white', 
          border: 'none' 
        }}
      >
        Gửi
      </button>

      {result && <p style={{ marginTop: '10px' }}>{result}</p>}
    </div>
  );
}