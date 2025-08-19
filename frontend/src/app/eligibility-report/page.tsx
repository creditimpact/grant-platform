'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getCaseId, setCaseId } from '@/lib/case-store';
import type { EligibilitySnapshot } from '@/lib/types';
import { safeError } from '@/utils/logger';

function formatError(path: string, err: any) {
  const status = err?.response?.status;
  const message = err?.response?.data?.message || err.message;
  return `${path} ${status || ''} ${message}`;
}

export default function EligibilityReport() {
  const router = useRouter();
  const [data, setData] = useState<EligibilitySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const caseId = getCaseId();

  const fetchReport = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await api.get('/eligibility-report', {
        params: { caseId },
      });
      if (res.data.caseId) setCaseId(res.data.caseId);
      setData(res.data.eligibility || res.data);
    } catch (err) {
      setError(formatError('/eligibility-report', err));
      safeError('eligibility fetch', err);
    } finally {
      setLoading(false);
    }
  };

  const computeReport = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await api.post('/eligibility-report', { caseId });
      if (res.data.caseId) setCaseId(res.data.caseId);
      setData(res.data.eligibility || res.data);
      setError(undefined);
    } catch (err) {
      setError(formatError('/eligibility-report', err));
      safeError('eligibility compute', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!caseId) {
    return (
      <div className="p-6 text-center space-y-4">
        <p>No case found. Upload documents first.</p>
        <button
          onClick={() => router.push('/dashboard/documents')}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Go to Documents
        </button>
      </div>
    );
  }

  if (loading && !data) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Eligibility Report</h1>
      {error && (
        <div className="bg-red-100 text-red-800 p-2 rounded">{error}</div>
      )}
      <button
        onClick={computeReport}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Recompute
      </button>
      {data ? (
        <>
          <p className="text-sm text-gray-700">Last Updated: {data.lastUpdated}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {data.results.map((r) => (
              <div key={r.name} className="border p-2 rounded">
                <div className="font-medium">{r.name}</div>
                <div>
                  Eligible:{' '}
                  {r.eligible === null ? 'Unknown' : r.eligible ? 'Yes' : 'No'}
                </div>
                {r.estimated_amount !== undefined && (
                  <div>Estimated Amount: ${r.estimated_amount}</div>
                )}
                {r.missing_fields?.length ? (
                  <div className="text-xs text-yellow-700">
                    Missing: {r.missing_fields.join(', ')}
                  </div>
                ) : null}
                {(r.reasoning || r.rationale) && (
                  <div className="text-xs text-gray-700">
                    {(r.reasoning || r.rationale)?.join(', ')}
                  </div>
                )}
                {r.next_steps && (
                  <div className="text-xs text-gray-700">Next: {r.next_steps}</div>
                )}
              </div>
            ))}
          </div>
          {data.requiredForms?.length ? (
            <div>
              <h2 className="font-semibold mt-4">Required Forms</h2>
              <ul className="list-disc list-inside">
                {data.requiredForms.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button
                onClick={() => router.push('/dashboard/documents')}
                className="mt-2 px-4 py-2 bg-green-600 text-white rounded"
              >
                Generate Forms
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p>No report available.</p>
      )}
    </div>
  );
}
