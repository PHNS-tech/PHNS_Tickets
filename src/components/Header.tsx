"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useWallet, useAddress, useWalletList } from '@meshsdk/react';

export function Header() {
  const [useFallback, setUseFallback] = useState(false);
  const { connect, disconnect, connected } = useWallet();
  const address = useAddress();
  const walletList = useWalletList();

  const shortAddr = (a?: string) => {
    if (!a) return '';
    return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
  };

  const handleConnectClick = () => {
    if (walletList && walletList.length > 0) {
      connect?.(walletList[0].name);
    } else {
      // fallback: call connect without args if API supports it
      // (some mesh implementations accept no-arg to open picker)
      // @ts-ignore
      connect?.();
    }
  };

  return (
    <header style={{ backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!useFallback ? (
            <img
              src="/ph-drawing.png"
              alt="PH"
              onError={() => setUseFallback(true)}
              style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ width: 40, height: 40, background: '#ff6b6b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13 }}>PH</div>
          )}

          <Link href="/" style={{ textDecoration: 'none', color: '#111', fontSize: 18, fontWeight: 600 }}>PHNS Tickets</Link>
        </div>

        <nav style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <Link href="/CreateTicket" style={{ textDecoration: 'none', color: '#333' }}>Create Ticket</Link>
          <Link href="/Marketplace" style={{ textDecoration: 'none', color: '#333' }}>Marketplace</Link>
          <Link href="/Burn" style={{ textDecoration: 'none', color: '#333' }}>Burn</Link>
          <Link href="/SmartContract" style={{ textDecoration: 'none', color: '#333' }}>Smart Contract</Link>
        </nav>

        <div style={{ marginLeft: 18 }}>
          {!connected ? (
            <button onClick={handleConnectClick} style={{ padding: '8px 12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Connect Wallet</button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: '#333' }}>{shortAddr(address)}</div>
              <button onClick={() => disconnect?.()} style={{ padding: '6px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Disconnect</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}