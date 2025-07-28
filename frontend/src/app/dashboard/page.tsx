'use client';
import Protected from '@/components/Protected';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <Protected>
      <div>
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p>Welcome, {user?.email}!</p>
        <div className="mt-4 space-x-2">
          <Link href="/upload" className="px-4 py-2 bg-blue-600 text-white rounded">Upload Documents</Link>
          <Link href="/eligibility-report" className="px-4 py-2 border rounded">Eligibility Report</Link>
        </div>
      </div>
    </Protected>
  );
}
