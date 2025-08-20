'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStatus, postEligibilityReport } from '@/lib/api';
import { getCaseId, setCaseId } from '@/lib/case-store';
import type { CaseSnapshot } from '@/lib/types';
import { safeError } from '@/utils/logger';

function formatError(path: string, err: any) {
  const status = err?.response?.status;
  const message = err?.response?.data?.message || err.message;
  return `${path} ${status || ''} ${message}`;
}

export default function EligibilityReport() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CaseSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const caseId = getCaseId();

  const fetchReport = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await getStatus(caseId);
      if (res.caseId) setCaseId(res.caseId);
      setSnapshot(res);
    } catch (err) {
      setError(formatError('status', err));
      safeError('eligibility fetch', err);
    } finally {
      setLoading(false);
    }
  };

  const computeReport = async () => {
    if (!caseId) return;
    setGenerating(true);
    try {
      const res = await postEligibilityReport({ caseId });
      if (res.caseId) setCaseId(res.caseId);
      setSnapshot(res);
      setError(undefined);
    } catch (err) {
      setError(formatError('/eligibility-report', err));
      safeError('eligibility compute', err);
    } finally {
      setGenerating(false);
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

  if (loading && !snapshot) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Eligibility Report</h1>
      {error && (
        <div className="bg-red-100 text-red-800 p-2 rounded">{error}</div>
      )}
      <button
        onClick={computeReport}
        disabled={generating}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        Generate report & required forms
      </button>
      {generating && <p>Generating forms...</p>}
      {snapshot?.eligibility && snapshot.eligibility.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {snapshot.eligibility.map((r) => (
              <div key={r.name} className="border p-2 rounded">
                <div className="font-medium">{r.name}</div>
                <div>
                  Eligible:{' '}
                  {r.eligible === null ? 'Unknown' : r.eligible ? 'Yes' : 'No'}
                </div>
                {r.estimated_amount !== undefined && (
                  <div>Estimated Amount: ${r.estimated_amount}</div>
                )}
                <div className="text-xs text-yellow-700">
                  Missing: {r.missing_fields.length ? r.missing_fields.join(', ') : '—'}
                </div>
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
          {(() => {
            const forms = Array.from(
              new Set(
                snapshot.eligibility.flatMap((r) => r.requiredForms || [])
              )
            );
            return forms.length ? (
              <div>
                <h2 className="font-semibold mt-4">Required Forms</h2>
                <ul className="list-disc list-inside">
                  {forms.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null;
          })()}
          {snapshot.generatedForms?.length ? (
            <div>
              <h2 className="font-semibold mt-4">Generated Forms</h2>
              <ul className="list-disc list-inside">
                {snapshot.generatedForms.map((f) => (
                  <li key={f.name}>{f.name}{f.status ? ` - ${f.status}` : ''}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p>No eligibility results yet — generate the report.</p>
      )}
    </div>
  );
}
