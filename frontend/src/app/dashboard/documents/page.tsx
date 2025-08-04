'use client';
/**
 * Document upload step for grant application.
 * Allows users to upload required files and trigger analysis.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Protected from '@/components/Protected';
import api from '@/lib/api';

export default function Documents() {
  const router = useRouter();
  const [caseData, setCaseData] = useState<any>(null);
  const [uploads, setUploads] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    const res = await api.get('/case/status');
    setCaseData(res.data);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleUpload = async (key: string) => {
    const file = uploads[key];
    if (!file) return;

    // Ensure file type is supported before attempting upload
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) {
      alert('Unsupported file type');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', key);
    try {
      await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchStatus();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Upload failed');
    }
  };

  if (!caseData) return (
    <Protected><p>Loading...</p></Protected>
  );

  const docs = Array.isArray(caseData.documents) ? caseData.documents : [];
  const uploadedCount = docs.filter((d: any) => d.uploaded).length;
  const allUploaded = docs.length > 0 && uploadedCount === docs.length;

  const submitAnalysis = async () => {
    setLoading(true);
    try {
      await api.post('/eligibility-report');
      await fetchStatus();
      localStorage.setItem('caseStage', 'results');
      router.push('/dashboard');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Protected>
      <div className="py-6 max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Upload Documents</h1>
        <p className="text-sm text-gray-600">Accepted formats: PDF, JPG, JPEG, PNG.</p>
        {docs.map((doc: any) => (
          <div key={doc.key} className="flex items-center space-x-3">
            <span className="w-48">
              {doc.name}
              {doc.reason && (
                <span className="block text-xs text-gray-500">{doc.reason}</span>
              )}
            </span>
            {doc.uploaded ? (
              <>
                <span className="text-green-600">✓ Uploaded</span>
                {doc.mimetype?.startsWith('image/') && doc.url ? (
                  <img
                    src={doc.url}
                    alt={doc.name}
                    className="w-16 h-16 object-cover"
                  />
                ) : (
                  <span className="text-sm text-gray-600">{doc.originalname}</span>
                )}
                {doc.url && (
                  <a
                    href={doc.url}
                    className="text-blue-600"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View
                  </a>
                )}
              </>
            ) : (
              <>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    setUploads({ ...uploads, [doc.key]: e.target.files?.[0] || null })
                  }
                />
                {uploads[doc.key] && (
                  <span className="text-sm text-gray-600">
                    {uploads[doc.key]?.name}
                  </span>
                )}
                <button
                  onClick={() => handleUpload(doc.key)}
                  className="px-2 py-1 bg-blue-600 text-white rounded"
                >
                  Upload
                </button>
              </>
            )}
          </div>
        ))}
        <div className="h-2 bg-gray-200 rounded">
          <div
            className="h-full bg-green-500 rounded"
            style={{ width: `${(uploadedCount / docs.length) * 100}%` }}
          />
        </div>
        {allUploaded && (
          <button
            onClick={submitAnalysis}
            className="px-4 py-2 bg-purple-600 text-white rounded"
          >
            {loading ? 'Submitting...' : 'Submit for Analysis'}
          </button>
        )}
      </div>
    </Protected>
  );
}
