'use client';
import { useState } from 'react';
import { postFormFill } from '@/lib/apiClient';
import type { CaseSnapshot } from '@/lib/types';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SummaryStep({
  snapshot,
  onRestart,
}: {
  snapshot: CaseSnapshot;
  onRestart: () => void;
}) {
  const [snap, setSnap] = useState(snapshot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateForms() {
    if (!snap.caseId || !snap.requiredForms) return;
    setLoading(true);
    setError(null);
    try {
      const { generatedForms } = await postFormFill(
        snap.caseId,
        snap.requiredForms,
      );
      setSnap({ ...snap, generatedForms });
    } catch (e: any) {
      setError(e.message ?? 'Failed to generate forms');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Summary</h2>
      <p className="text-sm text-gray-700">Case ID: {snap.caseId}</p>
      {snap.documents && snap.documents.length > 0 && (
        <div>
          <h3 className="font-semibold">Documents</h3>
          <ul className="list-disc list-inside text-sm">
            {snap.documents.map((d) => (
              <li key={d.key || d.filename}>{d.filename}</li>
            ))}
          </ul>
        </div>
      )}
      {snap.eligibility && snap.eligibility.length > 0 && (
        <div>
          <h3 className="font-semibold">Eligibility Results</h3>
          <ul className="list-disc list-inside text-sm space-y-2">
            {snap.eligibility.map((r) => (
              <li key={r.name}>
                <div>
                  {r.name}: {r.eligible === null ? 'Unknown' : r.eligible ? 'Yes' : 'No'}
                </div>
                {typeof r.estimated_amount === 'number' && (
                  <div aria-label="Estimated amount">{formatCurrency(r.estimated_amount)}</div>
                )}
                {r.generatedForms && r.generatedForms.length > 0 && (
                  <ul aria-label="Generated forms" className="list-disc list-inside ml-4">
                    {r.generatedForms.map((form, index) => (
                      <li key={form.formId || index}>
                        {form.url ? (
                          <a
                            href={form.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {`View draft (${form.name})`}
                          </a>
                        ) : (
                          'Draft unavailable'
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {snap.generatedForms && snap.generatedForms.length > 0 && (
        <div>
          <h3 className="font-semibold">Generated Forms</h3>
          <ul className="list-disc list-inside text-sm">
            {snap.generatedForms.map((form, index) => (
              <li key={form.formId || index}>
                {form.url ? (
                  <a
                    href={form.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {`View draft (${form.name})`}
                  </a>
                ) : (
                  'Draft unavailable'
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {snap.requiredForms?.length && !snap.generatedForms?.length ? (
        <div className="mt-3">
          <button
            onClick={handleGenerateForms}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate Forms'}
          </button>
          {error && (
            <p role="alert" className="text-red-600 mt-2">
              {error}
            </p>
          )}
        </div>
      ) : null}
      <button
        onClick={onRestart}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        Start Over
      </button>
    </div>
  );
}
