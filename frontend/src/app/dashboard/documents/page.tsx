'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStatus, uploadFile } from '@/lib/api';
import { getCaseId, setCaseId } from '@/lib/case-store';
import type { CaseSnapshot, CaseDoc } from '@/lib/types';
import { safeError } from '@/utils/logger';

function formatError(path: string, err: any) {
  const status = err?.response?.status;
  const message = err?.response?.data?.message || err.message;
  return `${path} ${status || ''} ${message}`;
}

export default function Documents() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CaseSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [deltas, setDeltas] = useState<Record<string, unknown> | null>(null);

  const load = async () => {
    const id = getCaseId();
    if (!id) return;
    setLoading(true);
    try {
      const res = await getStatus(id);
      if (res.caseId) setCaseId(res.caseId);
      setSnapshot(res);
    } catch (err) {
      setError(formatError(`/status/${id}`, err));
      safeError('documents status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const id = getCaseId();
    if (id) formData.append('caseId', id);
    setLoading(true);
    try {
      const prev = snapshot?.analyzerFields || {};
      const res = await uploadFile(formData);
      if (res.caseId) setCaseId(res.caseId);
      setSnapshot(res);
      const next = res.analyzerFields || {};
      const added: Record<string, unknown> = {};
      Object.entries(next).forEach(([k, v]) => {
        if (prev[k] === undefined) added[k] = v;
      });
      setDeltas(Object.keys(added).length ? added : null);
      setError(undefined);
    } catch (err) {
      setError(formatError('/files/upload', err));
      safeError('upload', err);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  if (loading && !snapshot) return <p className="p-6">Loading...</p>;

  const docs: CaseDoc[] = snapshot?.documents || [];

  return (
    <div className="p-6 space-y-4">
      {error && (
        <div className="bg-red-100 text-red-800 p-2 rounded">{error}</div>
      )}
      <div>
        <input type="file" onChange={handleUpload} />
      </div>
      {snapshot && (
        <>
          <p className="text-sm text-gray-700">Case ID: {snapshot.caseId}</p>
          {docs.length === 0 ? (
            <p>No documents yet — upload your first document.</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => (
                <li key={d.key || d.filename} className="border p-2 rounded">
                  <div className="font-medium">{d.filename}</div>
                  <div className="text-xs text-gray-600">
                    {d.size} bytes · {d.contentType}
                  </div>
                  <div className="text-xs text-gray-600">Uploaded: {d.uploadedAt}</div>
                </li>
              ))}
            </ul>
          )}
          {deltas && (
            <div>
              <h2 className="font-semibold mt-4">New Analyzer Fields</h2>
              <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
                {JSON.stringify(deltas, null, 2)}
              </pre>
            </div>
          )}
          {snapshot.analyzerFields && (
            <div>
              <h2 className="font-semibold mt-4">All Analyzer Fields</h2>
              <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
                {JSON.stringify(snapshot.analyzerFields, null, 2)}
              </pre>
            </div>
          )}
          {docs.length > 0 && (
            <button
              onClick={() => router.push('/eligibility-report')}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Run Eligibility
            </button>
          )}
        </>
      )}
    </div>
  );
}
