'use client';
import type { CaseSnapshot } from '@/lib/types';

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
          <ul className="list-disc list-inside text-sm">
            {snapshot.eligibility.map((r) => (
              <li key={r.name}>
                {r.name}: {r.eligible === null ? 'Unknown' : r.eligible ? 'Yes' : 'No'}
              </li>
            ))}
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
