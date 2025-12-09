import '../globals.css';
import { MeshProviderWrapper } from '../components/Wallet/MeshProviderWrapper';

export const metadata = {
    title: 'PHNS Tickets',
    description: 'Ticket marketplace based on Cardano demos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <MeshProviderWrapper>{children}</MeshProviderWrapper>
            </body>
        </html>
    );
}
