'use client';
import { useState } from 'react';
import { postQuestionnaire } from '@/lib/apiClient';
import type { CaseSnapshot } from '@/lib/types';

export default function QuestionnaireStep({
  caseId,
  onComplete,
  onBack,
}: {
  caseId: string;
  onComplete: (snap: CaseSnapshot) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState({
    ein: '',
    entityType: '',
    employees: '',
    revenue: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const snap = await postQuestionnaire({ caseId, answers: form });
      onComplete(snap);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold">Questionnaire</h2>
      {error && <div className="bg-red-100 text-red-800 p-2 rounded">{error}</div>}
      <div>
        <label htmlFor="ein" className="block text-sm">EIN</label>
        <input
          id="ein"
          name="ein"
          value={form.ein}
          onChange={handleChange}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label htmlFor="entityType" className="block text-sm">Entity Type</label>
        <input
          id="entityType"
          name="entityType"
          value={form.entityType}
          onChange={handleChange}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label htmlFor="employees" className="block text-sm">Employees</label>
        <input
          id="employees"
          name="employees"
          value={form.employees}
          onChange={handleChange}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label htmlFor="revenue" className="block text-sm">Revenue</label>
        <input
          id="revenue"
          name="revenue"
          value={form.revenue}
          onChange={handleChange}
          className="border p-1 w-full"
        />
      </div>
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-2 rounded bg-gray-200"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Next'}
        </button>
      </div>
    </form>
  );
}
