'use client';
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
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Summary</h2>
      <p className="text-sm text-gray-700">Case ID: {snapshot.caseId}</p>
      {snapshot.documents && snapshot.documents.length > 0 && (
        <div>
          <h3 className="font-semibold">Documents</h3>
          <ul className="list-disc list-inside text-sm">
            {snapshot.documents.map((d) => (
              <li key={d.key || d.filename}>{d.filename}</li>
            ))}
          </ul>
        </div>
      )}
      {snapshot.eligibility && snapshot.eligibility.length > 0 && (
        <div>
          <h3 className="font-semibold">Eligibility Results</h3>
          <ul className="list-disc list-inside text-sm space-y-2">
            {snapshot.eligibility.map((r) => {
              const grantForms = [
                ...(r.generatedForms || []),
                ...((snapshot.generatedForms || []).filter(
                  (f) => f.grantId === r.name,
                )),
              ];
              return (
                <li key={r.name}>
                  <div>
                    {r.name}: {r.eligible === null ? 'Unknown' : r.eligible ? 'Yes' : 'No'}
                  </div>
                  {typeof r.estimated_amount === 'number' && (
                    <div aria-label="Estimated amount">{formatCurrency(r.estimated_amount)}</div>
                  )}
                  {grantForms.length > 0 && (
                    <ul aria-label="Generated forms" className="list-disc list-inside ml-4">
                      {grantForms.map((f) => (
                        <li key={f.url}>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {`View draft ${f.name}`}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <button
        onClick={onRestart}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        Start Over
      </button>
    </div>
  );
}
