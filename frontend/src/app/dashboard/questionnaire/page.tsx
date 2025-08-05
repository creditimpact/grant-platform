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
import Stepper from '@/components/Stepper';

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
    locationZone: '',
    businessType: '',
    ein: '',
    ssn: '',
    incorporationDate: '',
    dateEstablished: '',
    annualRevenue: '',
    netProfit: '',
    employees: '',
    ownershipPercent: '',
    previousGrants: '',
    cpaPrepared: false,
    minorityOwned: false,
    womanOwned: false,
    veteranOwned: false,
    hasPayroll: false,
    hasInsurance: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const stepRequirements: Record<number, string[]> = {
      0: ['businessName', 'phone', 'email', 'address', 'city', 'state', 'zip', 'locationZone'],
      1: ['businessType', 'dateEstablished'],
      2: ['annualRevenue', 'netProfit', 'employees', 'ownershipPercent', 'previousGrants'],
      3: [],
    };
    const required = stepRequirements[step] || [];
    if (step === 1) {
      if (answers.businessType === 'Corporation' || answers.businessType === 'LLC') {
        required.push('incorporationDate', 'ein');
      } else if (answers.businessType === 'Sole') {
        required.push('ssn');
      } else {
        required.push('ein');
      }
    }
    required.forEach((field) => {
      if (!answers[field as keyof typeof answers]) {
        newErrors[field] = 'Required';
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const next = () => {
    if (validate()) setStep((s) => Math.min(s + 1, 3));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const goBack = () => {
    if (step === 0) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('questionnaire', JSON.stringify(answers));
        localStorage.removeItem('caseStage');
      }
      router.push('/dashboard');
    } else {
      prev();
    }
  };

  const finish = async () => {
    if (!validate()) return;
    localStorage.setItem('questionnaire', JSON.stringify(answers));
    try {
      await api.post('/case/questionnaire', answers);
      localStorage.setItem('caseStage', 'documents');
      router.push('/dashboard/documents');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Unable to save');
    }
  };

  return (
    <Protected>
      <div className="max-w-xl mx-auto py-6 space-y-4">
        <Stepper
          steps={["Business", "Ownership", "Financials", "Compliance"]}
          current={step}
        />
        <h1 className="text-2xl font-bold">Grant Questionnaire</h1>
        {step === 0 && (
          <>
            <FormInput
              label="Business Name"
              value={answers.businessName}
              error={errors.businessName}
              onChange={(e) => {
                setAnswers({ ...answers, businessName: e.target.value });
                if (errors.businessName) setErrors({ ...errors, businessName: '' });
              }}
            />
            <FormInput
              label="Business Phone"
              value={answers.phone}
              error={errors.phone}
              onChange={(e) => {
                setAnswers({ ...answers, phone: e.target.value });
                if (errors.phone) setErrors({ ...errors, phone: '' });
              }}
            />
            <FormInput
              label="Business Email"
              type="email"
              value={answers.email}
              error={errors.email}
              onChange={(e) => {
                setAnswers({ ...answers, email: e.target.value });
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
            />
            <FormInput
              label="Address"
              value={answers.address}
              error={errors.address}
              onChange={(e) => {
                setAnswers({ ...answers, address: e.target.value });
                if (errors.address) setErrors({ ...errors, address: '' });
              }}
            />
            <FormInput
              label="City"
              value={answers.city}
              error={errors.city}
              onChange={(e) => {
                setAnswers({ ...answers, city: e.target.value });
                if (errors.city) setErrors({ ...errors, city: '' });
              }}
            />
            <FormInput
              label="State"
              value={answers.state}
              error={errors.state}
              onChange={(e) => {
                setAnswers({ ...answers, state: e.target.value });
                if (errors.state) setErrors({ ...errors, state: '' });
              }}
            />
            <FormInput
              label="Zip Code"
              value={answers.zip}
              error={errors.zip}
              onChange={(e) => {
                setAnswers({ ...answers, zip: e.target.value });
                if (errors.zip) setErrors({ ...errors, zip: '' });
              }}
            />
            <label className="block mb-2 font-medium">Location Zone</label>
            <select
              className="w-full border rounded p-2 mb-1"
              value={answers.locationZone}
              onChange={(e) => {
                setAnswers({ ...answers, locationZone: e.target.value });
                if (errors.locationZone) setErrors({ ...errors, locationZone: '' });
              }}
            >
              <option value="">Select</option>
              <option value="urban">Urban</option>
              <option value="rural">Rural</option>
              <option value="hubzone">HUBZone</option>
            </select>
            {errors.locationZone && (
              <p className="text-red-600 text-sm mb-2">{errors.locationZone}</p>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <label className="block mb-2 font-medium">Business Type</label>
            <select
              className="w-full border rounded p-2 mb-1"
              value={answers.businessType}
              onChange={(e) => {
                setAnswers({ ...answers, businessType: e.target.value });
                if (errors.businessType) setErrors({ ...errors, businessType: '' });
              }}
            >
              <option value="">Select</option>
              <option value="Sole">Sole Proprietorship</option>
              <option value="Partnership">Partnership</option>
              <option value="LLC">LLC</option>
              <option value="Corporation">Corporation</option>
            </select>
            {errors.businessType && (
              <p className="text-red-600 text-sm mb-2">{errors.businessType}</p>
            )}
              {(answers.businessType === 'Corporation' || answers.businessType === 'LLC') && (
                <FormInput
                  label="Incorporation Date"
                  type="date"
                  value={answers.incorporationDate}
                  error={errors.incorporationDate}
                  onChange={(e) => {
                    setAnswers({ ...answers, incorporationDate: e.target.value });
                    if (errors.incorporationDate)
                      setErrors({ ...errors, incorporationDate: '' });
                  }}
                />
              )}
              <FormInput
                label="Date Established"
                type="date"
                value={answers.dateEstablished}
                error={errors.dateEstablished}
                onChange={(e) => {
                  setAnswers({ ...answers, dateEstablished: e.target.value });
                  if (errors.dateEstablished)
                    setErrors({ ...errors, dateEstablished: '' });
                }}
              />
              {answers.businessType === 'Sole' ? (
                <FormInput
                  label="Owner SSN"
                  value={answers.ssn}
                  error={errors.ssn}
                  onChange={(e) => {
                    setAnswers({ ...answers, ssn: e.target.value });
                    if (errors.ssn) setErrors({ ...errors, ssn: '' });
                  }}
                />
              ) : (
                <FormInput
                  label="Business EIN"
                  value={answers.ein}
                  error={errors.ein}
                  onChange={(e) => {
                    setAnswers({ ...answers, ein: e.target.value });
                    if (errors.ein) setErrors({ ...errors, ein: '' });
                  }}
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
              error={errors.annualRevenue}
              onChange={(e) => {
                setAnswers({ ...answers, annualRevenue: e.target.value });
                if (errors.annualRevenue)
                  setErrors({ ...errors, annualRevenue: '' });
              }}
            />
            <FormInput
              label="Net Profit"
              type="number"
              value={answers.netProfit}
              error={errors.netProfit}
              onChange={(e) => {
                setAnswers({ ...answers, netProfit: e.target.value });
                if (errors.netProfit) setErrors({ ...errors, netProfit: '' });
              }}
            />
            <FormInput
              label="Number of Employees"
              type="number"
              value={answers.employees}
              error={errors.employees}
              onChange={(e) => {
                setAnswers({ ...answers, employees: e.target.value });
                if (errors.employees) setErrors({ ...errors, employees: '' });
              }}
            />
            <FormInput
              label="Ownership Percentage"
              type="number"
              value={answers.ownershipPercent}
              error={errors.ownershipPercent}
              onChange={(e) => {
                setAnswers({ ...answers, ownershipPercent: e.target.value });
                if (errors.ownershipPercent)
                  setErrors({ ...errors, ownershipPercent: '' });
              }}
            />
            <label className="block mb-2 font-medium">Previous Grants</label>
            <select
              className="w-full border rounded p-2 mb-1"
              value={answers.previousGrants}
              onChange={(e) => {
                setAnswers({ ...answers, previousGrants: e.target.value });
                if (errors.previousGrants)
                  setErrors({ ...errors, previousGrants: '' });
              }}
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            {errors.previousGrants && (
              <p className="text-red-600 text-sm mb-2">{errors.previousGrants}</p>
            )}
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
              <label className="inline-flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={answers.hasPayroll}
                  onChange={(e) =>
                    setAnswers({ ...answers, hasPayroll: e.target.checked })
                  }
                />
                <span>Has Payroll</span>
              </label>
              <label className="inline-flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={answers.hasInsurance}
                  onChange={(e) =>
                    setAnswers({ ...answers, hasInsurance: e.target.checked })
                  }
                />
                <span>Business Insurance</span>
              </label>
            </div>
          )}
        <div className="flex justify-between pt-4">
          <button onClick={goBack} className="px-4 py-2 border rounded">
            Back
          </button>
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
