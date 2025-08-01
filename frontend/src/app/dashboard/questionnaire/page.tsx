'use client';
/**
 * Questionnaire wizard for collecting grant information.
 * Saves answers to localStorage and moves user to the upload step.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Protected from '@/components/Protected';
import FormInput from '@/components/FormInput';
import api from '@/lib/api';

export default function Questionnaire() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    businessName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    businessType: '',
    ein: '',
    ssn: '',
    incorporationDate: '',
    dateEstablished: '',
    annualRevenue: '',
    netProfit: '',
    employees: '',
    cpaPrepared: false,
    minorityOwned: false,
    womanOwned: false,
    veteranOwned: false,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/case/questionnaire');
        setAnswers((prev) => ({ ...prev, ...res.data }));
      } catch {
        const saved = localStorage.getItem('questionnaire');
        if (saved) setAnswers(JSON.parse(saved));
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    localStorage.setItem('questionnaire', JSON.stringify(answers));
    await api.post('/case/questionnaire', answers);
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
              label="Business Phone"
              value={answers.phone}
              onChange={(e) =>
                setAnswers({ ...answers, phone: e.target.value })
              }
            />
            <FormInput
              label="Business Email"
              type="email"
              value={answers.email}
              onChange={(e) => setAnswers({ ...answers, email: e.target.value })}
            />
            <FormInput
              label="Address"
              value={answers.address}
              onChange={(e) =>
                setAnswers({ ...answers, address: e.target.value })
              }
            />
            <FormInput
              label="City"
              value={answers.city}
              onChange={(e) => setAnswers({ ...answers, city: e.target.value })}
            />
            <FormInput
              label="State"
              value={answers.state}
              onChange={(e) => setAnswers({ ...answers, state: e.target.value })}
            />
            <FormInput
              label="Zip Code"
              value={answers.zip}
              onChange={(e) => setAnswers({ ...answers, zip: e.target.value })}
            />
          </>
        )}
        {step === 1 && (
          <>
            <label className="block mb-2 font-medium">Business Type</label>
            <select
              className="w-full border rounded p-2 mb-4"
              value={answers.businessType}
              onChange={(e) =>
                setAnswers({ ...answers, businessType: e.target.value })
              }
            >
              <option value="">Select</option>
              <option value="Sole">Sole Proprietorship</option>
              <option value="Partnership">Partnership</option>
              <option value="LLC">LLC</option>
              <option value="Corporation">Corporation</option>
            </select>
            {(answers.businessType === 'Corporation' || answers.businessType === 'LLC') && (
              <FormInput
                label="Incorporation Date"
                type="date"
                value={answers.incorporationDate}
                onChange={(e) =>
                  setAnswers({ ...answers, incorporationDate: e.target.value })
                }
              />
            )}
            <FormInput
              label="Date Established"
              type="date"
              value={answers.dateEstablished}
              onChange={(e) =>
                setAnswers({ ...answers, dateEstablished: e.target.value })
              }
            />
            {answers.businessType === 'Sole' ? (
              <FormInput
                label="Owner SSN"
                value={answers.ssn}
                onChange={(e) => setAnswers({ ...answers, ssn: e.target.value })}
              />
            ) : (
              <FormInput
                label="Business EIN"
                value={answers.ein}
                onChange={(e) => setAnswers({ ...answers, ein: e.target.value })}
              />
            )}
          </>
        )}
        {step === 2 && (
          <>
            <FormInput
              label="Annual Revenue"
              type="number"
              value={answers.annualRevenue}
              onChange={(e) =>
                setAnswers({ ...answers, annualRevenue: e.target.value })
              }
            />
            <FormInput
              label="Net Profit"
              type="number"
              value={answers.netProfit}
              onChange={(e) =>
                setAnswers({ ...answers, netProfit: e.target.value })
              }
            />
            <FormInput
              label="Number of Employees"
              type="number"
              value={answers.employees}
              onChange={(e) =>
                setAnswers({ ...answers, employees: e.target.value })
              }
            />
          </>
        )}
        {step === 3 && (
          <div className="space-y-2">
            <label className="inline-flex items-center space-x-2">
              <input
                type="checkbox"
                checked={answers.cpaPrepared}
                onChange={(e) =>
                  setAnswers({ ...answers, cpaPrepared: e.target.checked })
                }
              />
              <span>CPA Prepared Financials</span>
            </label>
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
            <label className="inline-flex items-center space-x-2">
              <input
                type="checkbox"
                checked={answers.womanOwned}
                onChange={(e) =>
                  setAnswers({ ...answers, womanOwned: e.target.checked })
                }
              />
              <span>Woman Owned</span>
            </label>
            <label className="inline-flex items-center space-x-2">
              <input
                type="checkbox"
                checked={answers.veteranOwned}
                onChange={(e) =>
                  setAnswers({ ...answers, veteranOwned: e.target.checked })
                }
              />
              <span>Veteran Owned</span>
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
          {step < 3 && (
            <button
              onClick={next}
              className="px-4 py-2 bg-blue-600 text-white rounded ml-auto"
            >
              Next
            </button>
          )}
          {step === 3 && (
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
