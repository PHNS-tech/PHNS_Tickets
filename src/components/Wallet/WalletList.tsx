'use client';

import { useWalletList, useWallet } from '@meshsdk/react';

export default function WalletList() {
    const list = useWalletList();
    const { connect } = useWallet();

    if (!list || list.length === 0) return null;

    return (
        <div style={{ display: 'grid', gap: 8 }}>
            {list.map((w, i) => (
                <button key={i} onClick={() => connect(w.name)} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={w.icon} alt={w.name} style={{ width: 28, height: 28 }} />
                    <div>
                        <div style={{ fontWeight: 600 }}>{w.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>v{w.version}</div>
                    </div>
                </button>
            ))}
        </div>
    );
}
