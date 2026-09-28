import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
    title: 'Loan origination workbench',
    icons: { icon: 'data:,' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en-GB">
            <body>
                <header className="banner">
                    <p className="brand">Loan origination workbench</p>
                    <nav aria-label="Main">
                        <Link href="/applications">Applications</Link>
                    </nav>
                </header>
                <main id="main">{children}</main>
            </body>
        </html>
    );
}
