'use client';
/**
 * Main dashboard showing case progress and results.
 * Redirects to steps based on localStorage state.
 */
import Protected from '@/components/Protected';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [caseData, setCaseData] = useState<any>(null);

  const fetchStatus = async () => {
    const res = await api.get('/case/status');
    setCaseData(res.data);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (!caseData) return (
    <Protected><p>Loading...</p></Protected>
  );

  const stage = typeof window !== 'undefined' ? localStorage.getItem('caseStage') : null;

  if (!stage || stage === 'open') {
    return (
      <Protected>
        <div className="text-center py-10 space-y-4">
          <h1 className="text-2xl font-bold">Welcome, {user?.email}</h1>
          <button
            onClick={() => {
              localStorage.setItem('caseStage', 'questionnaire');
              router.push('/dashboard/questionnaire');
            }}
            className="px-6 py-3 bg-blue-700 text-white rounded text-lg"
          >
            OPEN CASE
          </button>
        </div>
      </Protected>
    );
  }

  if (caseData.eligibility) {
    const results = Array.isArray(caseData.eligibility.results)
      ? caseData.eligibility.results
      : [];
    return (
      <Protected>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Eligibility Results</h1>
          <p>{caseData.eligibility.summary}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((r: any) => (
              <div key={r.name} className="border p-4 rounded shadow">
                <h3 className="font-semibold text-lg mb-1">{r.name}</h3>
                <p>Eligible: {r.eligible ? 'Yes' : 'No'}</p>
                <p>Score: {r.score}%</p>
                <p>Estimated Amount: ${r.estimated_amount}</p>
              </div>
            ))}
          </div>
          {!results.length && (
            <p>No grants matched your information.</p>
          )}
        </div>
      </Protected>
    );
  }

  return (
    <Protected>
      <div className="py-10 space-y-4 text-center">
        <p>Case in progress. Please complete remaining steps.</p>
        {stage === 'questionnaire' && (
          <button
            onClick={() => router.push('/dashboard/questionnaire')}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Continue Questionnaire
          </button>
        )}
        {stage === 'documents' && (
          <button
            onClick={() => router.push('/dashboard/documents')}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Go to Documents
          </button>
        )}
      </div>
    </Protected>
  );
}
