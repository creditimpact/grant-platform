'use client';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto flex items-center justify-between p-4">
        <Link href="/" className="text-lg font-bold">Grant Platform</Link>
        <nav className="space-x-4">
          {user ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <button onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link href="/login">Login</Link>
              <Link href="/register">Register</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
