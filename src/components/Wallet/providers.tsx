import dynamic from 'next/dynamic';

// Dynamically load the client-side MeshProvider wrapper to avoid SSR importing WASM/native modules
const MeshProviderWrapper = dynamic(
    () => import('./MeshProviderWrapper').then((m) => m.MeshProviderWrapper),
    { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
    return <MeshProviderWrapper>{children}</MeshProviderWrapper>;
}
