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
          {/* Ticket SVG logo */}
          <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="40" height="40" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ticket logo">
              <rect x="1" y="6" width="22" height="12" rx="2.5" fill="#ff6b6b" />
              <path d="M6 6v-2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              <path d="M18 6v-2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              <circle cx="7" cy="12" r="1.6" fill="#fff" />
              <circle cx="17" cy="12" r="1.6" fill="#fff" />
              <path d="M6 18v2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              <path d="M18 18v2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            </svg>
          </div>

          <Link href="/" style={{ textDecoration: 'none', color: '#111', fontSize: 18, fontWeight: 600 }}>PHNS Tickets</Link>
        </div>

        <nav style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <Link href="/CreateTicket" style={{ textDecoration: 'none', color: '#333' }}>Create Ticket</Link>
          <Link href="/Marketplace" style={{ textDecoration: 'none', color: '#333' }}>Marketplace</Link>
          <Link href="/MyTicket" style={{ textDecoration: 'none', color: '#333' }}>My Ticket</Link>
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