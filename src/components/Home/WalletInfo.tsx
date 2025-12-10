"use client";
import { useAddress, useLovelace, useWallet } from '@meshsdk/react';

export function WalletInfo() {
  // Lấy thông tin từ ví
  const address = useAddress();
  const balance = useLovelace();
  const { disconnect } = useWallet();

  return (
    <div style={{ 
      background: '#d4edda',
      padding: '15px', 
      borderRadius: '5px',
      margin: '10px 0' 
    }}>
      <h3>Đã kết nối ví thành công</h3>
      <p><strong>Địa chỉ ví:</strong> {address}</p>
      <p><strong>Số dư:</strong> {balance ? (Number(balance) / 1000000).toFixed(2) : '0'} ADA</p>
      
      <button 
        onClick={disconnect}
        style={{
          background: '#dc3545',
          color: 'white',
          border: 'none',
          padding: '8px 15px',
          borderRadius: '5px',
          cursor: 'pointer',
          marginTop: '10px'
        }}
      >
        Ngắt kết nối
      </button>
    </div>
  );
}