'use client';
/**
 * Questionnaire wizard for collecting grant information.
 * Saves answers to sessionStorage and moves user to the upload step.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FormInput from '@/components/FormInput';
import { api } from '@/lib/api';
import Stepper from '@/components/Stepper';
import { safeError, safeLog } from '@/utils/logger';
import { getCaseId, setCaseId } from '@/lib/case-store';

const logApiError = (endpoint: string, payload: unknown, err: any) => {
  const status = err?.response?.status;
  const data = err?.response?.data ?? err?.message;
  safeError(`API Error on ${endpoint}`, { status, response: data });
  if (data?.missing) {
    safeError('Missing fields', data.missing);
  }
};

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
    serviceAreaPopulation: '',
    organizationType: '',
    incomeLevel: '',
    businessType: '',
    ein: '',
    ssn: '',
    duns: '',
    sam: '',
    cageCode: '',
      incorporationDate: '',
      annualRevenue: '',
      netProfit: '',
      numberOfEmployees: '',
      ownershipPercentage: '',
      businessIncome: '',
      businessExpenses: '',
      taxPaid: '',
      taxYear: '',
      projectType: '',
      projectCost: '',
      projectState: '',
      previousRefundsClaimed: '',
      previousGrants: '',
      cpaPrepared: false,
      minorityOwned: false,
      womanOwned: false,
      veteranOwned: false,
      hasPayroll: false,
    hasInsurance: false,
  });
  const [missingHints, setMissingHints] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const id = getCaseId();
        const res = await api.get('/case/questionnaire', {
          params: { caseId: id },
        });
        if (res.data.caseId) setCaseId(res.data.caseId);
        const data = res.data.data || {};
        setMissingHints(res.data.missingFieldsHint || []);
        const mapped = {
          ...data,
          businessType: data.businessType || data.entityType || '',
          numberOfEmployees: data.numberOfEmployees || data.employees || '',
          ownershipPercentage:
            data.ownershipPercentage || data.ownershipPercent || '',
          incorporationDate: data.incorporationDate || data.dateEstablished || '',
        };
        setAnswers((prev) => ({
          ...prev,
          ...mapped,
          previousGrants:
            typeof mapped.previousGrants === 'boolean'
              ? mapped.previousGrants
                ? 'yes'
                : 'no'
              : prev.previousGrants,
          previousRefundsClaimed:
            typeof mapped.previousRefundsClaimed === 'boolean'
              ? mapped.previousRefundsClaimed
                ? 'yes'
                : 'no'
              : prev.previousRefundsClaimed,
          sam:
            typeof mapped.sam === 'boolean'
              ? mapped.sam
                ? 'yes'
                : 'no'
              : mapped.sam || prev.sam,
        }));
      } catch (err: any) {
        logApiError('/case/questionnaire', undefined, err);
        setError(`/case/questionnaire ${err?.response?.status || ''} ${err?.response?.data?.message || err.message}`);
        const saved = sessionStorage.getItem('questionnaire');
        if (saved) setAnswers(JSON.parse(saved));
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = () => {
    setStep((s) => Math.min(s + 1, 3));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const goBack = () => {
    if (step === 0) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('questionnaire', JSON.stringify(answers));
        sessionStorage.removeItem('caseStage');
      }
      router.push('/dashboard');
    } else {
      prev();
    }
  };

  const finish = async () => {
    sessionStorage.setItem('questionnaire', JSON.stringify(answers));
    try {
      const payload = {
        ...answers,
        annualRevenue: Number(answers.annualRevenue),
        netProfit: Number(answers.netProfit),
        numberOfEmployees: Number(answers.numberOfEmployees),
        ownershipPercentage: Number(answers.ownershipPercentage),
        businessIncome: Number(answers.businessIncome),
        businessExpenses: Number(answers.businessExpenses),
        taxPaid: Number(answers.taxPaid),
        taxYear: Number(answers.taxYear),
        serviceAreaPopulation: Number(answers.serviceAreaPopulation),
        projectCost: Number(answers.projectCost),
        previousRefundsClaimed: answers.previousRefundsClaimed === 'yes',
        previousGrants: answers.previousGrants === 'yes',
        sam: answers.sam === 'yes',
      };
      const res = await api.post('/case/questionnaire', {
        caseId: getCaseId(),
        data: payload,
      });
      if (res.data.caseId) setCaseId(res.data.caseId);
      setMissingHints(res.data.missingFieldsHint || []);
      if (process.env.NODE_ENV !== 'production') {
        safeLog('Questionnaire submitted successfully');
      }
      router.push('/dashboard/documents');
    } catch (err: any) {
      logApiError('/case/questionnaire', answers, err);
      setError(
        `/case/questionnaire ${err?.response?.status || ''} ${
          err?.response?.data?.message || err.message
        }`
      );
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;

  return (
      <div className="max-w-xl mx-auto py-6 space-y-4">
        <Stepper
          steps={["Business", "Ownership", "Financials", "Compliance"]}
          current={step}
        />
        {error && (
          <div className="bg-red-100 text-red-800 p-2 rounded">{error}</div>
        )}
        {missingHints.length > 0 && (
          <div className="bg-yellow-100 p-2 rounded text-sm">
            <p className="font-medium">Missing Information</p>
            <ul className="list-disc list-inside">
              {missingHints.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        <h1 className="text-2xl font-bold">Grant Questionnaire</h1>
        {step === 0 && (
          <>
            <FormInput
              label="Business Name"
              value={answers.businessName}
              onChange={(e) => {
                setAnswers({ ...answers, businessName: e.target.value });
              }}
            />
            <FormInput
              label="Business Phone"
              value={answers.phone}
              onChange={(e) => {
                setAnswers({ ...answers, phone: e.target.value });
              }}
            />
            <FormInput
              label="Business Email"
              type="email"
              value={answers.email}
              onChange={(e) => {
                setAnswers({ ...answers, email: e.target.value });
              }}
            />
            <FormInput
              label="Address"
              value={answers.address}
              onChange={(e) => {
                setAnswers({ ...answers, address: e.target.value });
              }}
            />
            <FormInput
              label="City"
              value={answers.city}
              onChange={(e) => {
                setAnswers({ ...answers, city: e.target.value });
              }}
            />
            <FormInput
              label="State"
              value={answers.state}
              onChange={(e) => {
                setAnswers({ ...answers, state: e.target.value });
              }}
            />
            <FormInput
              label="Zip Code"
              value={answers.zip}
              onChange={(e) => {
                setAnswers({ ...answers, zip: e.target.value });
              }}
            />
            <label className="block mb-2 font-medium">Location Zone</label>
            <select
              className="w-full border rounded p-2 mb-1"
              value={answers.locationZone}
              onChange={(e) => {
                setAnswers({ ...answers, locationZone: e.target.value });
              }}
            >
              <option value="">Select</option>
              <option value="urban">Urban</option>
              <option value="rural">Rural</option>
              <option value="hubzone">HUBZone</option>
            </select>
            <FormInput
              label="Service Area Population"
              type="number"
              value={answers.serviceAreaPopulation}
              onChange={(e) => {
                setAnswers({ ...answers, serviceAreaPopulation: e.target.value });
              }}
            />
            <label className="block mb-2 font-medium">Organization Type</label>
            <select
              className="w-full border rounded p-2 mb-1"
              value={answers.organizationType}
              onChange={(e) => {
                setAnswers({ ...answers, organizationType: e.target.value });
              }}
            >
              <option value="">Select</option>
              <option value="public_entity">Public Entity</option>
              <option value="municipality">Municipality</option>
              <option value="local_authority">Local Authority</option>
              <option value="tribal_government">Tribal Government</option>
              <option value="nonprofit">Nonprofit Organization</option>
              <option value="cooperative">Cooperative</option>
              <option value="utility">Utility</option>
            </select>
            <label className="block mb-2 font-medium">Community Income Level</label>
            <select
              className="w-full border rounded p-2 mb-1"
              value={answers.incomeLevel}
              onChange={(e) => {
                setAnswers({ ...answers, incomeLevel: e.target.value });
              }}
            >
              <option value="">Select</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
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
              }}
            >
              <option value="">Select</option>
              <option value="Sole">Sole Proprietorship</option>
              <option value="Partnership">Partnership</option>
              <option value="LLC">LLC</option>
              <option value="Corporation">Corporation</option>
            </select>
            <FormInput
              label="Incorporation Date"
              type="date"
              value={answers.incorporationDate}
              onChange={(e) => {
                setAnswers({ ...answers, incorporationDate: e.target.value });
              }}
            />
            {answers.businessType === 'Sole' ? (
                <FormInput
                  label="Owner SSN"
                  value={answers.ssn}
                  onChange={(e) => {
                    setAnswers({ ...answers, ssn: e.target.value });
                  }}
                />
              ) : (
                <FormInput
                  label="Business EIN"
                  value={answers.ein}
                  onChange={(e) => {
                    setAnswers({ ...answers, ein: e.target.value });
                  }}
                />
              )}
            <FormInput
              label="DUNS Number"
              value={answers.duns}
              onChange={(e) => {
                setAnswers({ ...answers, duns: e.target.value });
              }}
            />
            <label className="block mb-2 font-medium">SAM Registration</label>
            <select
              className="w-full border rounded p-2 mb-1"
              value={answers.sam}
              onChange={(e) => {
                setAnswers({ ...answers, sam: e.target.value });
              }}
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            <FormInput
              label="CAGE Code"
              value={answers.cageCode}
              onChange={(e) => {
                setAnswers({ ...answers, cageCode: e.target.value });
              }}
            />
          </>
        )}
        {step === 2 && (
          <>
            <FormInput
              label="Annual Revenue"
              type="number"
              value={answers.annualRevenue}
              onChange={(e) => {
                setAnswers({ ...answers, annualRevenue: e.target.value });
              }}
            />
            <FormInput
              label="Net Profit"
              type="number"
              value={answers.netProfit}
              onChange={(e) => {
                setAnswers({ ...answers, netProfit: e.target.value });
              }}
            />
            <FormInput
              label="Number of Employees"
              type="number"
              value={answers.numberOfEmployees}
              onChange={(e) => {
                setAnswers({ ...answers, numberOfEmployees: e.target.value });
              }}
            />
              <FormInput
                label="Ownership Percentage"
                type="number"
                value={answers.ownershipPercentage}
                onChange={(e) => {
                  setAnswers({ ...answers, ownershipPercentage: e.target.value });
                }}
              />
              <FormInput
                label="Business Income"
                type="number"
                value={answers.businessIncome}
                onChange={(e) => {
                  setAnswers({ ...answers, businessIncome: e.target.value });
                }}
              />
              <FormInput
                label="Business Expenses"
                type="number"
                value={answers.businessExpenses}
                onChange={(e) => {
                  setAnswers({ ...answers, businessExpenses: e.target.value });
                }}
              />
              <FormInput
                label="Tax Paid"
                type="number"
                value={answers.taxPaid}
                onChange={(e) => {
                  setAnswers({ ...answers, taxPaid: e.target.value });
                }}
              />
              <FormInput
                label="Tax Year"
                type="number"
              value={answers.taxYear}
              onChange={(e) => {
                setAnswers({ ...answers, taxYear: e.target.value });
              }}
            />
            <label className="block mb-2 font-medium">Project Type</label>
            <select
              className="w-full border rounded p-2 mb-1"
              value={answers.projectType}
              onChange={(e) => {
                setAnswers({ ...answers, projectType: e.target.value });
              }}
            >
              <option value="">Select</option>
              <option value="community_facilities">Community Facilities</option>
              <option value="rbdg">Rural Business Development</option>
              <option value="rcdg">Rural Cooperative Development</option>
              <option value="redlg">Rural Economic Development Loan/Grant</option>
            </select>
            <FormInput
              label="Project Cost"
              type="number"
              value={answers.projectCost}
              onChange={(e) => {
                setAnswers({ ...answers, projectCost: e.target.value });
              }}
            />
            <FormInput
              label="Project State"
              value={answers.projectState}
              onChange={(e) => {
                setAnswers({ ...answers, projectState: e.target.value });
              }}
            />
            <label className="block mb-2 font-medium">Previous Grants</label>
            <select
              className="w-full border rounded p-2 mb-1"
              value={answers.previousGrants}
              onChange={(e) => {
                setAnswers({ ...answers, previousGrants: e.target.value });
                }}
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              <label className="block mb-2 font-medium">Previous Refunds Claimed</label>
              <select
                className="w-full border rounded p-2 mb-1"
                value={answers.previousRefundsClaimed}
                onChange={(e) => {
                  setAnswers({ ...answers, previousRefundsClaimed: e.target.value });
                }}
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
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
  );
}
