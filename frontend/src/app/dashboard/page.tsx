'use client';
import Protected from '@/components/Protected';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function Dashboard() {
  const { user } = useAuth();
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState<Record<string, File | null>>({});

  useEffect(() => {
    api.get('/case/status').then(res => setCaseData(res.data));
  }, []);

  const handleUpload = async (key: string) => {
    const file = uploads[key];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', key);
    await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const updated = await api.get('/case/status');
    setCaseData(updated.data);
  };

  const startAnalysis = async () => {
    setLoading(true);
    await api.post('/eligibility-report');
    const updated = await api.get('/case/status');
    setCaseData(updated.data);
    setLoading(false);
  };

  const submitCase = async () => {
    await api.post('/case/submit');
    const updated = await api.get('/case/status');
    setCaseData(updated.data);
  };

  if (!caseData) return (
    <Protected><p>Loading...</p></Protected>
  );

  const allUploaded = Array.isArray(caseData.documents)
    ? caseData.documents.every((d: any) => d.uploaded)
    : false;

  return (
    <Protected>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Welcome, {user?.email}</h1>
        <p>Status: {caseData.status}</p>

        <div>
          <h2 className="font-semibold">Required Documents</h2>
          {Array.isArray(caseData.documents) ? (
            caseData.documents.map((doc: any) => (
              <div key={doc.key} className="my-2 flex items-center space-x-2">
                <span>{doc.name}</span>
                {doc.uploaded ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <>
                    <input
                      type="file"
                      onChange={e =>
                        setUploads({ ...uploads, [doc.key]: e.target.files?.[0] || null })
                      }
                    />
                    <button
                      onClick={() => handleUpload(doc.key)}
                      className="px-2 py-1 bg-blue-600 text-white rounded"
                    >
                      Upload
                    </button>
                  </>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600">No document data available.</p>
          )}
        </div>

        {allUploaded && !caseData.eligibility && (
          <button onClick={startAnalysis} className="px-4 py-2 bg-purple-600 text-white rounded">
            {loading ? 'Analyzing...' : 'Start Analysis'}
          </button>
        )}

        {caseData.eligibility && (
          <div className="border p-4 rounded">
            <p>Eligible: {caseData.eligibility.eligible ? 'Yes' : 'No'}</p>
            <p>{caseData.eligibility.summary}</p>
            <h3 className="font-semibold mt-2">Forms</h3>
            <ul className="list-disc ml-6">
              {caseData.eligibility.forms.map((f: string) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {caseData.status !== 'Submitted' && caseData.eligibility && (
          <button onClick={submitCase} className="px-4 py-2 bg-green-600 text-white rounded">Submit Case</button>
        )}

        {caseData.status === 'Submitted' && (
          <p className="text-green-700 font-bold">Your case is submitted!</p>
        )}
      </div>
    </Protected>
  );
}
