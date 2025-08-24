'use client';
import { useState } from 'react';
import { uploadFile } from '@/lib/apiClient';
import type { CaseDoc, CaseSnapshot } from '@/lib/types';

export default function UploadStep({
  caseId,
  docs,
  onUploaded,
  onNext,
  onBack,
}: {
  caseId: string;
  docs: CaseDoc[];
  onUploaded: (snap: CaseSnapshot) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    if (caseId) fd.append('caseId', caseId);
    setLoading(true);
    setError(undefined);
    try {
      const snap = await uploadFile(fd);
      onUploaded(snap);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const hasDocs = docs && docs.length > 0;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Upload Documents</h2>
      {error && <div className="bg-red-100 text-red-800 p-2 rounded">{error}</div>}
      <input type="file" onChange={handleUpload} disabled={loading} />
      {docs.length > 0 && (
        <ul className="space-y-1">
          {docs.map((d) => (
            <li key={d.key || d.filename} className="text-sm">
              {d.filename}
            </li>
          ))}
        </ul>
      )}
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
          onClick={onNext}
          disabled={!hasDocs}
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
