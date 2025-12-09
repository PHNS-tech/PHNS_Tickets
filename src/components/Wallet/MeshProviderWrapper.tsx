'use client';

import { MeshProvider } from '@meshsdk/react';
import WalletList from './WalletList';
import WalletInfo from './WalletInfo';
import ConnectWallet from './ConnectWallet';

export function MeshProviderWrapper({ children }: { children: React.ReactNode }) {
    return (
        <MeshProvider>
            <div style={{ minHeight: '100vh' }}>
                <header style={{ borderBottom: '1px solid #e5e7eb', padding: 12, background: '#f9fafb' }}>
                    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h1 style={{ margin: 0 }}>🎫 PHNS Tickets</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <ConnectWallet />
                            <WalletInfo />
                        </div>
                    </div>
                </header>

                <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
                    <div style={{ marginBottom: 16 }}>
                        <WalletList />
                    </div>

                    {children}
                </div>
            </div>
        </MeshProvider>
    );
}
