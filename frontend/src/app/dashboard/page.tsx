'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStatus } from '@/lib/api';
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
    const load = async () => {
      setLoading(true);
      try {
        const id = getCaseId();
        const res = await getStatus(id);
        if (res.caseId) setCaseId(res.caseId);
        setSnapshot(res);
      } catch (err: any) {
        setError(formatError('status', err));
        safeError('dashboard status', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (!snapshot && !loading) {
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
          {snapshot.analyzerFields && (
            <div>
              <h2 className="font-semibold mt-4">Analyzer Fields</h2>
              <table className="w-full text-sm bg-gray-50 rounded">
                <tbody>
                  {Object.entries(snapshot.analyzerFields).map(([k, v]) => (
                    <tr key={k} className="border-b last:border-none">
                      <td className="p-1 font-medium w-1/3 break-words">{k}</td>
                      <td className="p-1 break-words">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {snapshot.eligibility && snapshot.eligibility.length > 0 ? (
            <div>
              <h2 className="font-semibold mt-4">Eligibility Results</h2>
              <div className="grid gap-2 md:grid-cols-2">
                {snapshot.eligibility.map((r) => (
                  <div key={r.name} className="border p-2 rounded space-y-1">
                    <div className="font-medium">{r.name}</div>
                    <div>
                      Eligible:{' '}
                      {r.eligible === null
                        ? 'Unknown'
                        : r.eligible
                        ? 'Yes'
                        : 'No'}
                    </div>
                    {r.score !== undefined && <div>Score: {r.score}</div>}
                    {r.estimated_amount !== undefined && (
                      <div>Estimated Amount: ${r.estimated_amount}</div>
                    )}
                    {r.missing_fields && r.missing_fields.length > 0 && (
                      <div className="mt-1 bg-yellow-50 text-yellow-800 p-2 rounded">
                        <p className="text-xs font-medium">Missing fields</p>
                        <ul className="list-disc list-inside text-xs">
                          {r.missing_fields.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {r.next_steps && (
                      <p className="text-xs text-gray-700">Next: {r.next_steps}</p>
                    )}
                    {(r.reasoning || r.rationale) && (
                      <details className="text-xs">
                        <summary className="cursor-pointer">Why?</summary>
                        <div className="ml-4 mt-1">
                          {Array.isArray(r.reasoning || r.rationale)
                            ? (
                                <ul className="list-disc list-inside">
                                  {(r.reasoning || r.rationale).map((x) => (
                                    <li key={x}>{x}</li>
                                  ))}
                                </ul>
                              )
                            : (
                                <span>{r.reasoning || r.rationale}</span>
                              )}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p>No eligibility results yet — generate the report.</p>
          )}
        </>
      )}
    </div>
  );
}
