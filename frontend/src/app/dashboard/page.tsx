'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getCaseId, setCaseId } from '@/lib/case-store';
import type { CaseSnapshot } from '@/lib/types';
import { safeError } from '@/utils/logger';

function formatError(path: string, err: any) {
  const status = err?.response?.status;
  const message = err?.response?.data?.message || err.message;
  return `${path} ${status || ''} ${message}`;
}

export default function Dashboard() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CaseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const id = getCaseId();
    if (!id) {
      setLoading(false);
      return;
    }
    api
      .get(`/status/${id}`)
      .then((res) => {
        if (res.data.caseId) setCaseId(res.data.caseId);
        setSnapshot(res.data);
      })
      .catch((err) => {
        setError(formatError(`/status/${id}`, err));
        safeError('dashboard status', err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (!getCaseId()) {
    return (
      <div className="p-6 text-center space-y-4">
        <h1 className="text-2xl font-bold">Welcome</h1>
        <p>No case open.</p>
        <button
          onClick={() => router.push('/dashboard/questionnaire')}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Open a case
        </button>
      </div>
    );
  }

  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6 space-y-4">
      {error && (
        <div className="bg-red-100 text-red-800 p-2 rounded">{error}</div>
      )}
      {snapshot && (
        <>
          <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
          <p className="text-sm text-gray-700">Case ID: {snapshot.caseId}</p>
          <p>Status: {snapshot.status}</p>
          {snapshot.analyzer?.fields && (
            <div>
              <h2 className="font-semibold mt-4">Analyzer Fields</h2>
              <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
                {JSON.stringify(snapshot.analyzer.fields, null, 2)}
              </pre>
            </div>
          )}
          {snapshot.eligibility && (
            <div>
              <h2 className="font-semibold mt-4">Eligibility Results</h2>
              <div className="grid gap-2 md:grid-cols-2">
                {snapshot.eligibility.results.map((r) => (
                  <div key={r.name} className="border p-2 rounded">
                    <div className="font-medium">{r.name}</div>
                    <div>
                      Eligible:{' '}
                      {r.eligible === null
                        ? 'Unknown'
                        : r.eligible
                        ? 'Yes'
                        : 'No'}
                    </div>
                    {r.estimated_amount !== undefined && (
                      <div>Estimated Amount: ${r.estimated_amount}</div>
                    )}
                    {(r.reasoning || r.rationale) && (
                      <div className="text-xs text-gray-700">
                        {(r.reasoning || r.rationale)?.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {snapshot.eligibility.requiredForms?.length ? (
                <div className="mt-2">
                  <h3 className="font-medium">Required Forms</h3>
                  <ul className="list-disc list-inside">
                    {snapshot.eligibility.requiredForms.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
