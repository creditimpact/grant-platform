'use client';
import { useState } from 'react';
import { postEligibilityReport } from '@/lib/apiClient';
import type { CaseSnapshot } from '@/lib/types';

export default function EligibilityStep({
  caseId,
  onComplete,
  onBack,
}: {
  caseId: string;
  onComplete: (snap: CaseSnapshot) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleGenerate = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const snap = await postEligibilityReport({ caseId });
      onComplete(snap);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Eligibility Report</h2>
      {error && <div className="bg-red-100 text-red-800 p-2 rounded">{error}</div>}
      <p>Generate eligibility results based on uploaded documents.</p>
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-2 rounded bg-gray-200"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>
    </div>
  );
}
