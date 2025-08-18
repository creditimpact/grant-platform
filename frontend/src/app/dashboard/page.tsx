'use client';
/**
 * Main dashboard showing case progress and results.
 * Determines the current step from API status.
 */
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import Stepper from '@/components/Stepper';

export default function Dashboard() {
  const router = useRouter();
  const [caseData, setCaseData] = useState<any>(null);

  const fetchStatus = async () => {
    const res = await api.get('/case/status');
    setCaseData(res.data);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (!caseData) return <p>Loading...</p>;

  const computeStage = () => {
    if (caseData.status === 'not_started') return 'open';
    if (caseData.eligibility) return 'results';
    if (Array.isArray(caseData.documents) && caseData.documents.length > 0) {
      return 'documents';
    }
    return 'questionnaire';
  };

  const stage = computeStage();
  const localStage =
    typeof window !== 'undefined' ? sessionStorage.getItem('caseStage') : null;
  const displayStage =
    localStage === 'analysis' && stage !== 'results' ? 'analysis' : stage;

  if (stage === 'open' && typeof window !== 'undefined') {
    sessionStorage.removeItem('caseStage');
  }

  if (stage === 'open') {
    return (
      <div className="text-center py-10 space-y-4">
        <h1 className="text-2xl font-bold">Welcome</h1>
        <button
          onClick={() => {
            sessionStorage.setItem('caseStage', 'questionnaire');
            router.push('/dashboard/questionnaire');
          }}
          className="px-6 py-3 bg-blue-700 text-white rounded text-lg"
        >
          OPEN CASE
        </button>
      </div>
    );
  }

  if (caseData.eligibility) {
    const results = Array.isArray(caseData.eligibility.results)
      ? caseData.eligibility.results
      : [];
    return (
      <div className="space-y-4">
        <Stepper
          steps={["Questionnaire", "Documents", "Analysis", "Results"]}
          current={3}
        />
        <h1 className="text-2xl font-bold">Eligibility Results</h1>
        <p>{caseData.eligibility.summary}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((r: any) => (
            <div key={r.name} className="border p-4 rounded shadow">
              <h3 className="font-semibold text-lg mb-1">{r.name}</h3>
              <p>Eligible: {r.eligible ? 'Yes' : 'No'}</p>
              <p>Score: {r.score}%</p>
              <p>Estimated Amount: ${r.estimated_amount}</p>
            </div>
          ))}
        </div>
        {!results.length && <p>No grants matched your information.</p>}
      </div>
    );
  }

  return (
    <div className="py-10 space-y-4 text-center">
      <Stepper
        steps={["Questionnaire", "Documents", "Analysis", "Results"]}
        current={["questionnaire", "documents", "analysis", "results"].indexOf(displayStage)}
      />
      <p>Case in progress. Please complete remaining steps.</p>
      {stage === 'documents' && Array.isArray(caseData.documents) && (
        <div className="text-left inline-block">
          <p className="font-semibold">Missing Documents:</p>
          <ul className="list-disc list-inside">
            {caseData.documents
              .filter((d: any) => !d.uploaded)
              .map((d: any) => (
                <li key={d.key}>{d.name}</li>
              ))}
          </ul>
        </div>
      )}
      {stage === 'questionnaire' && (
        <button
          onClick={() => router.push('/dashboard/questionnaire')}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Continue Questionnaire
        </button>
      )}
      {stage === 'documents' && (
        <button
          onClick={() => router.push('/dashboard/documents')}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Go to Documents
        </button>
      )}
    </div>
  );
}
