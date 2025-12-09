import Link from 'next/link';

export default function Home() {
    return (
        <main style={{ padding: 32 }}>
            <h1>PHNS Tickets</h1>
            <p>Minimal ticket marketplace demo (mocked — Cardano-ready)</p>
            <nav style={{ display: 'flex', gap: 12 }}>
                <Link href="/marketplace">Marketplace</Link>
                <Link href="/create">Create Ticket</Link>
            </nav>
        </main>
    );
}
