"use client";
import { useWallet } from '@meshsdk/react';
import { WalletList } from '../components/Home/WalletList';
import { WalletInfo } from '../components/Home/WalletInfo';
import { AssetViewer } from '../components/Home/AssetViewer';
import { SendTransaction } from '../components/Home/SendTransaction';

export default function Home() {
  const { connected } = useWallet();

  return (
    <div>
      <h1>Ví Cardano của tôi</h1>
      
      {/* PHẦN 1: Hiển thị khi CHƯA kết nối ví */}
      {!connected && <WalletList />}

      {/* PHẦN 2: Hiển thị khi ĐÃ kết nối ví */}
      {connected && (
        <div>
          <WalletInfo />
          <AssetViewer />
          <SendTransaction /> 
        </div>
      )}
    </div>
  );
}