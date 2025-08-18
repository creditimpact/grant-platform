'use client';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white shadow">
      <div className="container mx-auto flex items-center justify-between p-4">
        <Link href="/" className="text-lg font-bold">Grant Platform</Link>
        <nav className="space-x-4">
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </div>
    </header>
  );
}
