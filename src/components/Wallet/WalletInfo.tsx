'use client';

import { useWallet, useAddress } from '@meshsdk/react';

export default function WalletInfo() {
    const { connected, disconnect } = useWallet();
    const address = useAddress();

    if (!connected) return null;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#e6ffed', padding: '6px 10px', borderRadius: 6 }}>
                ✅ {address?.slice?.(0, 16) ?? 'connected'}
            </div>
            <button onClick={() => disconnect()} style={{ padding: '6px 10px' }}>Disconnect</button>
        </div>
    );
}
