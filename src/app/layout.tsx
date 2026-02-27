import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FinancialsFast — AI-Powered P&L Statements',
  description: 'Generate lender-ready Profit & Loss statements from your bank statements in under 15 minutes. No accountant needed.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a1628] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
