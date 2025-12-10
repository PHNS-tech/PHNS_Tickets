// components/home/WalletList.tsx
"use client";
import { useWallet, useWalletList } from '@meshsdk/react';

export function WalletList() {
  const walletList = useWalletList();
  const { connect } = useWallet();

  return (
    <div>
      <h3>Chọn ví để kết nối:</h3>
      {walletList.map((wallet, index) => (
        <div 
          key={index}
          onClick={() => connect(wallet.name)}
          style={{ 
            display: 'flex', 
            padding: '10px', 
            border: '1px solid #ddd',
            backgroundColor: '#f8f9fa',
            margin: '10px 0',
            cursor: 'pointer',
            borderRadius: '5px'
          }}
        >
          <img src={wallet.icon} alt={wallet.name} width="30" />
          <div style={{ marginLeft: '10px' }}>
            <div><strong>{wallet.name}</strong></div>
            <small>Phiên bản {wallet.version}</small>
          </div>
        </div>
      ))}
    </div>
  );
}