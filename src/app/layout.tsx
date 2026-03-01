import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Financials Fast — AI-Powered P&L Generator',
  description: 'Generate a lender-ready Profit & Loss statement from your bank statements in 15 minutes. Built for small business owners applying for loans.',
  keywords: 'P&L statement, profit and loss, small business, loan application, financial statement',
  openGraph: {
    title: 'Financials Fast — P&L in 15 Minutes',
    description: 'Upload your bank statements. Get a lender-ready P&L PDF. No CPA needed.',
    url: 'https://financialsfast.com',
    siteName: 'Financials Fast',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
