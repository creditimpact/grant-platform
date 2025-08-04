import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SupportButton from '@/components/SupportButton';

export const metadata: Metadata = {
  title: 'Grant Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="min-h-screen container mx-auto p-4">{children}</main>
        <Footer />
        <SupportButton />
      </body>
    </html>
  );
}
