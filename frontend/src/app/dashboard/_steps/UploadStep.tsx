'use client';
import { useEffect, useState } from 'react';
import { uploadFile, getRequiredDocuments } from '@/lib/apiClient';
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
  const [required, setRequired] = useState<string[]>([]);

  useEffect(() => {
    getRequiredDocuments(caseId).then(setRequired).catch(() => setRequired([]));
  }, [caseId]);

  const handleUpload = async (
    reqDoc: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('caseId', caseId);
    fd.append('key', reqDoc);
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

  const allUploaded =
    required.length > 0 &&
    required.every((r) => docs.some((d) => d.key === r));

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Upload Documents</h2>
      {error && <div className="bg-red-100 text-red-800 p-2 rounded">{error}</div>}
      <ul className="space-y-2">
        {required.map((r) => {
          const uploaded = docs.some((d) => d.key === r);
          const slug = r.replace(/[^a-z0-9]/gi, '_');
          return (
            <li key={r} className="flex items-center space-x-2 text-sm">
              <span>{uploaded ? '✅' : '⬜'} {r}</span>
              {!uploaded && (
                <input
                  type="file"
                  data-testid={`upload-${slug}`}
                  onChange={(e) => handleUpload(r, e)}
                  disabled={loading}
                />
              )}
            </li>
          );
        })}
      </ul>
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
          disabled={!allUploaded}
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
