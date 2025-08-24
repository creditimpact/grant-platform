'use client';
import { useState } from 'react';
import { postQuestionnaire } from '@/lib/apiClient';
import type { CaseSnapshot } from '@/lib/types';

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const ENTITY_TYPES = ['LLC','C-Corp','S-Corp','Sole Proprietor','Nonprofit'];
const GENDERS = ['Male','Female','Other'];
const ETHNICITIES = ['Hispanic','African-American','Asian','Native American','White','Other'];
const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' }
];
const YES_NO_UNSURE = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' }
];

export default function QuestionnaireStep({ caseId, onComplete, onBack }: { caseId: string; onComplete: (snap: CaseSnapshot) => void; onBack: () => void; }) {
  const [form, setForm] = useState<Record<string, string>>({
    business_name: '',
    ein: '',
    year_established: '',
    entity_type: '',
    ownership_percentage: '',
    owner_veteran: '',
    owner_spouse_veteran: '',
    owner_gender: '',
    owner_ethnicity: '',
    w2_employee_count: '',
    w2_part_time_count: '',
    payroll_total: '',
    received_ppp: '',
    annual_revenue: '',
    revenue_decline: '',
    revenue_drop_percent: '',
    gov_shutdown: '',
    address: '',
    state: '',
    rural_area: '',
    opportunity_zone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const { revenue_decline, ...payload } = form;
      if (revenue_decline !== 'yes') {
        payload.revenue_drop_percent = '';
      }
      const snap = await postQuestionnaire({ caseId, answers: payload });
      onComplete(snap);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const renderOptions = (opts: string[]) => opts.map(o => <option key={o} value={o}>{o}</option>);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold">Questionnaire</h2>
      {error && <div className="bg-red-100 text-red-800 p-2 rounded">{error}</div>}

      <h3 className="text-xl font-semibold">Business Information</h3>
      <div>
        <label htmlFor="business_name" className="block text-sm">Business Name</label>
        <input id="business_name" name="business_name" value={form.business_name} onChange={handleChange} className="border p-1 w-full" />
      </div>
      <div>
        <label htmlFor="ein" className="block text-sm">EIN</label>
        <input id="ein" name="ein" value={form.ein} onChange={handleChange} pattern="^\d{2}-?\d{7}$" className="border p-1 w-full" />
      </div>
      <div>
        <label htmlFor="year_established" className="block text-sm">Year Established</label>
        <input type="number" id="year_established" name="year_established" value={form.year_established} onChange={handleChange} className="border p-1 w-full" />
      </div>
      <div>
        <label htmlFor="entity_type" className="block text-sm">Entity Type</label>
        <select id="entity_type" name="entity_type" value={form.entity_type} onChange={handleChange} className="border p-1 w-full">
          <option value="" />
          {ENTITY_TYPES.map(t => <option key={t} value={t.replace(/\s+/g,'_').toLowerCase()}>{t}</option>)}
        </select>
      </div>

      <h3 className="text-xl font-semibold">Ownership</h3>
      <div>
        <label htmlFor="ownership_percentage" className="block text-sm">Ownership Percentage</label>
        <input type="number" id="ownership_percentage" name="ownership_percentage" value={form.ownership_percentage} onChange={handleChange} className="border p-1 w-full" />
      </div>
      <div>
        <label htmlFor="owner_veteran" className="block text-sm">Veteran Owner?</label>
        <select id="owner_veteran" name="owner_veteran" value={form.owner_veteran} onChange={handleChange} className="border p-1 w-full">
          <option value="" />
          {YES_NO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="owner_spouse_veteran" className="block text-sm">Spouse of Veteran?</label>
        <select id="owner_spouse_veteran" name="owner_spouse_veteran" value={form.owner_spouse_veteran} onChange={handleChange} className="border p-1 w-full">
          <option value="" />
          {YES_NO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="owner_gender" className="block text-sm">Gender</label>
        <select id="owner_gender" name="owner_gender" value={form.owner_gender} onChange={handleChange} className="border p-1 w-full">
          <option value="" />
          {renderOptions(GENDERS)}
        </select>
      </div>
      <div>
        <label htmlFor="owner_ethnicity" className="block text-sm">Ethnicity</label>
        <select id="owner_ethnicity" name="owner_ethnicity" value={form.owner_ethnicity} onChange={handleChange} className="border p-1 w-full">
          <option value="" />
          {renderOptions(ETHNICITIES)}
        </select>
      </div>

      <h3 className="text-xl font-semibold">Employees & Payroll</h3>
      <div>
        <label htmlFor="w2_employee_count" className="block text-sm">Full-time Employees (W-2)</label>
        <input type="number" id="w2_employee_count" name="w2_employee_count" value={form.w2_employee_count} onChange={handleChange} className="border p-1 w-full" />
      </div>
      <div>
        <label htmlFor="w2_part_time_count" className="block text-sm">Part-time Employees (W-2)</label>
        <input type="number" id="w2_part_time_count" name="w2_part_time_count" value={form.w2_part_time_count} onChange={handleChange} className="border p-1 w-full" />
      </div>
      <div>
        <label htmlFor="payroll_total" className="block text-sm">Total Annual Payroll (USD)</label>
        <input type="number" id="payroll_total" name="payroll_total" value={form.payroll_total} onChange={handleChange} className="border p-1 w-full" />
      </div>
      <div>
        <label htmlFor="received_ppp" className="block text-sm">Received PPP Loan Before?</label>
        <select id="received_ppp" name="received_ppp" value={form.received_ppp} onChange={handleChange} className="border p-1 w-full">
          <option value="" />
          {YES_NO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <h3 className="text-xl font-semibold">Revenue & Financial Status</h3>
      <div>
        <label htmlFor="annual_revenue" className="block text-sm">Annual Revenue (USD)</label>
        <input type="number" id="annual_revenue" name="annual_revenue" value={form.annual_revenue} onChange={handleChange} className="border p-1 w-full" />
      </div>
      <div>
        <label htmlFor="revenue_decline" className="block text-sm">Revenue Decline vs. Previous Year?</label>
        <select id="revenue_decline" name="revenue_decline" value={form.revenue_decline} onChange={handleChange} className="border p-1 w-full">
          <option value="" />
          {YES_NO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {form.revenue_decline === 'yes' && (
        <div>
          <label htmlFor="revenue_drop_percent" className="block text-sm">Decline Percentage</label>
          <input type="number" id="revenue_drop_percent" name="revenue_drop_percent" value={form.revenue_drop_percent} onChange={handleChange} className="border p-1 w-full" />
        </div>
      )}
      <div>
        <label htmlFor="gov_shutdown" className="block text-sm">Temporary Shutdown due to Government Order?</label>
        <select id="gov_shutdown" name="gov_shutdown" value={form.gov_shutdown} onChange={handleChange} className="border p-1 w-full">
          <option value="" />
          {YES_NO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <h3 className="text-xl font-semibold">Location & Community</h3>
      <div>
        <label htmlFor="address" className="block text-sm">Business Address</label>
        <input id="address" name="address" value={form.address} onChange={handleChange} className="border p-1 w-full" />
      </div>
      <div>
        <label htmlFor="state" className="block text-sm">State</label>
        <select id="state" name="state" value={form.state} onChange={handleChange} className="border p-1 w-full">
          <option value="" />
          {renderOptions(STATES)}
        </select>
      </div>
      <div>
        <label htmlFor="rural_area" className="block text-sm">Rural Area?</label>
        <select id="rural_area" name="rural_area" value={form.rural_area} onChange={handleChange} className="border p-1 w-full">
          <option value="" />
          {YES_NO_UNSURE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="opportunity_zone" className="block text-sm">In Opportunity Zone?</label>
        <select id="opportunity_zone" name="opportunity_zone" value={form.opportunity_zone} onChange={handleChange} className="border p-1 w-full">
          <option value="" />
          {YES_NO_UNSURE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="px-3 py-2 rounded bg-gray-200">Back</button>
        <button type="submit" disabled={loading} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">{loading ? 'Saving...' : 'Next'}</button>
      </div>
    </form>
  );
}
