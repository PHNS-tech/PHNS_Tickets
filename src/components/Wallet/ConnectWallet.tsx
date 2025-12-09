"use client";

import { useState } from 'react';
import { useWalletList, useWallet } from '@meshsdk/react';
import WalletList from './WalletList';

export default function ConnectWallet() {
    const [open, setOpen] = useState(false);
    const list = useWalletList();
    const { connected } = useWallet();

    if (connected) return null;

    return (
        <div style={{ position: 'relative' }}>
            <button onClick={() => setOpen((s) => !s)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff' }}>
                Connect Wallet
            </button>

            {open && (
                <div style={{ position: 'absolute', right: 0, marginTop: 8, background: '#fff', padding: 10, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.08)', zIndex: 40 }}>
                    {list && list.length > 0 ? (
                        <WalletList />
                    ) : (
                        <div style={{ padding: 8 }}>Loading wallets…</div>
                    )}
                </div>
            )}
        </div>
    );
}
