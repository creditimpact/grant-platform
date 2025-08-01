'use client';
/**
 * Questionnaire wizard for collecting grant information.
 * Saves answers to localStorage and moves user to the upload step.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Protected from '@/components/Protected';
import FormInput from '@/components/FormInput';

export default function Questionnaire() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    businessName: '',
    industry: '',
    revenue: '',
    employees: '',
    minorityOwned: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem('questionnaire');
    if (saved) {
      setAnswers(JSON.parse(saved));
    }
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, 2));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const finish = () => {
    localStorage.setItem('questionnaire', JSON.stringify(answers));
    localStorage.setItem('caseStage', 'documents');
    router.push('/dashboard/documents');
  };

  return (
    <Protected>
      <div className="max-w-xl mx-auto py-6 space-y-4">
        <h1 className="text-2xl font-bold">Grant Questionnaire</h1>
        {step === 0 && (
          <>
            <FormInput
              label="Business Name"
              value={answers.businessName}
              onChange={(e) =>
                setAnswers({ ...answers, businessName: e.target.value })
              }
            />
            <FormInput
              label="Industry"
              value={answers.industry}
              onChange={(e) =>
                setAnswers({ ...answers, industry: e.target.value })
              }
            />
          </>
        )}
        {step === 1 && (
          <>
            <FormInput
              label="Annual Revenue"
              type="number"
              value={answers.revenue}
              onChange={(e) =>
                setAnswers({ ...answers, revenue: e.target.value })
              }
            />
            <FormInput
              label="Employees"
              type="number"
              value={answers.employees}
              onChange={(e) =>
                setAnswers({ ...answers, employees: e.target.value })
              }
            />
          </>
        )}
        {step === 2 && (
          <div className="mb-4">
            <label className="inline-flex items-center space-x-2">
              <input
                type="checkbox"
                checked={answers.minorityOwned}
                onChange={(e) =>
                  setAnswers({ ...answers, minorityOwned: e.target.checked })
                }
              />
              <span>Minority Owned</span>
            </label>
          </div>
        )}
        <div className="flex justify-between pt-4">
          {step > 0 && (
            <button
              onClick={prev}
              className="px-4 py-2 border rounded"
            >
              Back
            </button>
          )}
          {step < 2 && (
            <button
              onClick={next}
              className="px-4 py-2 bg-blue-600 text-white rounded ml-auto"
            >
              Next
            </button>
          )}
          {step === 2 && (
            <button
              onClick={finish}
              className="px-4 py-2 bg-green-600 text-white rounded ml-auto"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </Protected>
  );
}
