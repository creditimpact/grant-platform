'use client';
/**
 * Document upload step for grant application.
 * Allows users to upload required files and trigger analysis.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Stepper from '@/components/Stepper';
import { normalizeQuestionnaire } from '@/lib/validation';

export default function Documents() {
  const router = useRouter();
  const [caseData, setCaseData] = useState<any>(null);
  const [uploads, setUploads] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(false);
  const [replaceKey, setReplaceKey] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('');

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
      setUploads((u) => ({ ...u, [key]: null }));
      setReplaceKey(null);
      setSavedMessage('Saved!');
      setTimeout(() => setSavedMessage(''), 2000);
      fetchStatus();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Upload failed');
    }
  };

  if (!caseData) return <p>Loading...</p>;

  const docs = Array.isArray(caseData.documents) ? caseData.documents : [];
  const uploadedCount = docs.filter((d: any) => d.uploaded).length;

  const goBack = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('caseStage', 'questionnaire');
    }
    router.push('/dashboard/questionnaire');
  };

  const submitAnalysis = async () => {
    if (!confirm('Are you sure you want to submit?')) return;

    const saved =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('questionnaire')
        : null;
    const raw = saved ? JSON.parse(saved) : {};
    const { data, missing, invalid } = normalizeQuestionnaire(raw);
    if (missing.length || invalid.length) {
      alert(
        [
          'Please complete the questionnaire before submitting.',
          missing.length && `Missing: ${missing.join(', ')}`,
          invalid.length && `Invalid: ${invalid.join(', ')}`,
        ]
          .filter(Boolean)
          .join('\n'),
      );
      return;
    }

    setLoading(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('caseStage', 'analysis');
    }
    try {
      await api.post('/eligibility-report', data);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('caseStage', 'results');
      }
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Submission failed';
      const missingServer = err?.response?.data?.missing?.join(', ');
      const invalidServer = err?.response?.data?.invalid?.join(', ');
      alert(
        [
          msg,
          missingServer && `Missing: ${missingServer}`,
          invalidServer && `Invalid: ${invalidServer}`,
        ]
          .filter(Boolean)
          .join('\n'),
      );
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('caseStage', 'documents');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-6 max-w-xl mx-auto space-y-4">
      <Stepper
        steps={["Questionnaire", "Documents", "Analysis", "Results"]}
        current={loading ? 2 : 1}
      />
      {savedMessage && (
        <div className="text-green-600 text-sm">{savedMessage}</div>
      )}
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
              <button
                onClick={() => setReplaceKey(doc.key)}
                className="px-2 py-1 bg-gray-200 rounded"
              >
                Replace
              </button>
              {replaceKey === doc.key && (
                <>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) =>
                      setUploads({
                        ...uploads,
                        [doc.key]: e.target.files?.[0] || null,
                      })
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
            </>
          ) : (
            <>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    setUploads({
                      ...uploads,
                      [doc.key]: e.target.files?.[0] || null,
                    })
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
            style={{ width: `${docs.length ? (uploadedCount / docs.length) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between pt-4">
          <button onClick={goBack} className="px-4 py-2 border rounded">
            Back
          </button>
          <button
            onClick={submitAnalysis}
            className="px-4 py-2 bg-purple-600 text-white rounded ml-auto"
          >
            {loading ? 'Submitting...' : 'Submit for Analysis'}
          </button>
        </div>
      </div>
  );
}
