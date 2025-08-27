'use client';

import { useState } from 'react';
import { postQuestionnaire } from '@/lib/apiClient';
import type { CaseSnapshot } from '@/lib/types';

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT',
  'NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];
const ENTITY_TYPES = [
  'LLC',
  'Corporation',
  'Partnership',
  'Nonprofit',
  'Sole Proprietor',
  'Other'
];

interface Owner {
  name: string;
  role: string;
  percent: string;
  email: string;
  phone: string;
}

interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  congressionalDistrict: string;
}

interface Contact {
  name: string;
  title: string;
  phone: string;
  email: string;
}

const emptyAddress: Address = {
  street: '',
  city: '',
  state: '',
  zip: '',
  county: '',
  congressionalDistrict: '',
};

const emptyContact: Contact = { name: '', title: '', phone: '', email: '' };

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
    ownerFirstName: '',
    ownerLastName: '',
    ownerTitle: '',
    authorizedRepSameAsOwner: true,
    authorizedRepFirstName: '',
    authorizedRepLastName: '',
    authorizedRepTitle: '',
    legalBusinessName: '',
    dba: '',
    entityType: '',
    incorporationDate: '',
    incorporationState: '',
    physicalAddress: { ...emptyAddress },
    mailingAddress: { ...emptyAddress },
    numEmployees: '',
    projectTitle: '',
    fundingRequest: '',
    projectStart: '',
    projectEnd: '',
    hasEin: 'yes',
    ein: '',
    ssn: '',
    complianceCertify: false,
    eeoOfficer: { ...emptyContact },
  });
  const [owners, setOwners] = useState<Owner[]>([
    { name: '', role: '', percent: '', email: '', phone: '' },
  ]);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleAddressChange = (
    which: 'physicalAddress' | 'mailingAddress',
    field: keyof Address,
    value: string,
  ) => {
    setForm((f) => ({
      ...f,
      [which]: { ...f[which], [field]: value },
    }));
  };

  const handleEeoOfficerChange = (field: keyof Contact, value: string) => {
    setForm((f) => ({
      ...f,
      eeoOfficer: { ...f.eeoOfficer, [field]: value },
    }));
  };

  const handleOwnerChange = (idx: number, field: keyof Owner, value: string) => {
    setOwners((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, [field]: value } : o)),
    );
  };

  const addOwner = () => {
    setOwners((o) => [...o, { name: '', role: '', percent: '', email: '', phone: '' }]);
  };

  const removeOwner = (idx: number) => {
    setOwners((o) => o.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        numEmployees: form.numEmployees ? Number(form.numEmployees) : undefined,
        fundingRequest: form.fundingRequest ? Number(form.fundingRequest) : undefined,
        owners: owners.map((o) => ({
          ...o,
          percent: o.percent ? Number(o.percent) : undefined,
        })),
        ein: form.hasEin === 'yes' ? form.ein : undefined,
        ssn: form.hasEin === 'no' ? form.ssn : undefined,
        authorizedRepFirstName: form.authorizedRepSameAsOwner
          ? form.ownerFirstName
          : form.authorizedRepFirstName,
        authorizedRepLastName: form.authorizedRepSameAsOwner
          ? form.ownerLastName
          : form.authorizedRepLastName,
        authorizedRepTitle: form.authorizedRepSameAsOwner
          ? form.ownerTitle
          : form.authorizedRepTitle,
      };
      const snap = await postQuestionnaire({ caseId, answers: payload });
      onComplete(snap);
    } catch (err) {
      console.warn('Questionnaire submission failed', err);
    } finally {
      setLoading(false);
    }
  };

  const renderAddress = (which: 'physicalAddress' | 'mailingAddress', label: string) => (
    <div className="border p-2 space-y-2">
      <h4 className="font-semibold">{label}</h4>
      <div>
        <label htmlFor={`${which}-street`} className="block text-sm">Street</label>
        <input
          id={`${which}-street`}
          value={form[which].street}
          onChange={(e) => handleAddressChange(which, 'street', e.target.value)}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label htmlFor={`${which}-city`} className="block text-sm">City</label>
        <input
          id={`${which}-city`}
          value={form[which].city}
          onChange={(e) => handleAddressChange(which, 'city', e.target.value)}
          className="border p-1 w-full"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${which}-state`} className="block text-sm">State</label>
          <select
            id={`${which}-state`}
            value={form[which].state}
            onChange={(e) => handleAddressChange(which, 'state', e.target.value)}
            className="border p-1 w-full"
          >
            <option value="" />
            {STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${which}-zip`} className="block text-sm">ZIP</label>
          <input
            id={`${which}-zip`}
            value={form[which].zip}
            onChange={(e) => handleAddressChange(which, 'zip', e.target.value)}
            className="border p-1 w-full"
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${which}-county`} className="block text-sm">County</label>
        <input
          id={`${which}-county`}
          value={form[which].county}
          onChange={(e) => handleAddressChange(which, 'county', e.target.value)}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label htmlFor={`${which}-cd`} className="block text-sm">Congressional District</label>
        <input
          id={`${which}-cd`}
          value={form[which].congressionalDistrict}
          onChange={(e) => handleAddressChange(which, 'congressionalDistrict', e.target.value)}
          className="border p-1 w-full"
        />
      </div>
    </div>
  );

  const renderEeoOfficer = () => (
    <div className="border p-2 space-y-2">
      <h4 className="font-semibold">EEO Officer (optional)</h4>
      <div>
        <label htmlFor="eeoOfficer-name" className="block text-sm">Name</label>
        <input
          id="eeoOfficer-name"
          value={form.eeoOfficer.name}
          onChange={(e) => handleEeoOfficerChange('name', e.target.value)}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label htmlFor="eeoOfficer-title" className="block text-sm">Title</label>
        <input
          id="eeoOfficer-title"
          value={form.eeoOfficer.title}
          onChange={(e) => handleEeoOfficerChange('title', e.target.value)}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label htmlFor="eeoOfficer-phone" className="block text-sm">Phone</label>
        <input
          id="eeoOfficer-phone"
          value={form.eeoOfficer.phone}
          onChange={(e) => handleEeoOfficerChange('phone', e.target.value)}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label htmlFor="eeoOfficer-email" className="block text-sm">Email</label>
        <input
          id="eeoOfficer-email"
          type="email"
          value={form.eeoOfficer.email}
          onChange={(e) => handleEeoOfficerChange('email', e.target.value)}
          className="border p-1 w-full"
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold">Questionnaire</h2>

      <h3 className="text-xl font-semibold">Business Identity</h3>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="ownerFirstName" className="block text-sm">Owner First Name</label>
          <input
            id="ownerFirstName"
            name="ownerFirstName"
            value={form.ownerFirstName}
            onChange={handleChange}
            className="border p-1 w-full"
          />
        </div>
        <div>
          <label htmlFor="ownerLastName" className="block text-sm">Owner Last Name</label>
          <input
            id="ownerLastName"
            name="ownerLastName"
            value={form.ownerLastName}
            onChange={handleChange}
            className="border p-1 w-full"
          />
        </div>
        <div>
          <label htmlFor="ownerTitle" className="block text-sm">Owner Title</label>
          <input
            id="ownerTitle"
            name="ownerTitle"
            value={form.ownerTitle}
            onChange={handleChange}
            className="border p-1 w-full"
          />
        </div>
      </div>
      <div>
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            name="authorizedRepSameAsOwner"
            checked={form.authorizedRepSameAsOwner}
            onChange={handleChange}
            className="mr-2"
          />
          Authorized representative same as owner
        </label>
      </div>
      {!form.authorizedRepSameAsOwner && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="authorizedRepFirstName" className="block text-sm">Authorized Rep First Name</label>
            <input
              id="authorizedRepFirstName"
              name="authorizedRepFirstName"
              value={form.authorizedRepFirstName}
              onChange={handleChange}
              className="border p-1 w-full"
            />
          </div>
          <div>
            <label htmlFor="authorizedRepLastName" className="block text-sm">Authorized Rep Last Name</label>
            <input
              id="authorizedRepLastName"
              name="authorizedRepLastName"
              value={form.authorizedRepLastName}
              onChange={handleChange}
              className="border p-1 w-full"
            />
          </div>
          <div>
            <label htmlFor="authorizedRepTitle" className="block text-sm">Authorized Rep Title</label>
            <input
              id="authorizedRepTitle"
              name="authorizedRepTitle"
              value={form.authorizedRepTitle}
              onChange={handleChange}
              className="border p-1 w-full"
            />
          </div>
        </div>
      )}
      <div>
        <label htmlFor="legalBusinessName" className="block text-sm">Legal Business Name</label>
        <input
          id="legalBusinessName"
          name="legalBusinessName"
          value={form.legalBusinessName}
          onChange={handleChange}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label htmlFor="dba" className="block text-sm">DBA</label>
        <input id="dba" name="dba" value={form.dba} onChange={handleChange} className="border p-1 w-full" />
      </div>
      <div>
        <label htmlFor="entityType" className="block text-sm">Entity Type</label>
        <select
          id="entityType"
          name="entityType"
          value={form.entityType}
          onChange={handleChange}
          className="border p-1 w-full"
        >
          <option value="" />
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="incorporationDate" className="block text-sm">Date of Incorporation</label>
          <input
            type="date"
            id="incorporationDate"
            name="incorporationDate"
            value={form.incorporationDate}
            onChange={handleChange}
            className="border p-1 w-full"
          />
        </div>
        <div>
          <label htmlFor="incorporationState" className="block text-sm">State of Incorporation</label>
          <select
            id="incorporationState"
            name="incorporationState"
            value={form.incorporationState}
            onChange={handleChange}
            className="border p-1 w-full"
          >
            <option value="" />
            {STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {renderAddress('physicalAddress', 'Physical Address')}
      {renderAddress('mailingAddress', 'Mailing Address')}

      <div>
        <label htmlFor="numEmployees" className="block text-sm">Number of Employees</label>
        <input
          type="number"
          id="numEmployees"
          name="numEmployees"
          value={form.numEmployees}
          onChange={handleChange}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label htmlFor="projectTitle" className="block text-sm">Project Title/Short Description</label>
        <textarea
          id="projectTitle"
          name="projectTitle"
          value={form.projectTitle}
          onChange={handleChange}
          className="border p-1 w-full"
        />
      </div>
      <div>
        <label htmlFor="fundingRequest" className="block text-sm">Funding Request Amount (USD)</label>
        <input
          type="number"
          id="fundingRequest"
          name="fundingRequest"
          value={form.fundingRequest}
          onChange={handleChange}
          className="border p-1 w-full"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="projectStart" className="block text-sm">Project Start Date</label>
          <input
            type="date"
            id="projectStart"
            name="projectStart"
            value={form.projectStart}
            onChange={handleChange}
            className="border p-1 w-full"
          />
        </div>
        <div>
          <label htmlFor="projectEnd" className="block text-sm">Project End Date</label>
          <input
            type="date"
            id="projectEnd"
            name="projectEnd"
            value={form.projectEnd}
            onChange={handleChange}
            className="border p-1 w-full"
          />
        </div>
      </div>

      <h3 className="text-xl font-semibold">Tax Information</h3>
      <div>
        <span className="block text-sm">Do you have an EIN?</span>
        <label className="mr-4">
          <input
            type="radio"
            name="hasEin"
            value="yes"
            checked={form.hasEin === 'yes'}
            onChange={handleChange}
          />{' '}
          Yes
        </label>
        <label>
          <input
            type="radio"
            name="hasEin"
            value="no"
            checked={form.hasEin === 'no'}
            onChange={handleChange}
          />{' '}
          No
        </label>
      </div>
      {form.hasEin === 'yes' ? (
        <div>
          <label htmlFor="ein" className="block text-sm">EIN</label>
          <input
            id="ein"
            name="ein"
            value={form.ein}
            onChange={handleChange}
            pattern="^\d{9}$"
            className="border p-1 w-full"
          />
        </div>
      ) : (
        <div>
          <label htmlFor="ssn" className="block text-sm">SSN</label>
          <input
            id="ssn"
            name="ssn"
            type="password"
            value={form.ssn}
            onChange={handleChange}
            pattern="^\d{9}$"
            className="border p-1 w-full"
          />
        </div>
      )}

      <h3 className="text-xl font-semibold">Owners / Officers</h3>
      {owners.map((o, idx) => (
        <div key={idx} className="border p-2 mb-2 space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold">Owner #{idx + 1}</h4>
            {owners.length > 1 && (
              <button type="button" onClick={() => removeOwner(idx)} className="text-red-600 text-sm">
                Remove
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm" htmlFor={`owner-name-${idx}`}>Full Name</label>
              <input
                id={`owner-name-${idx}`}
                value={o.name}
                onChange={(e) => handleOwnerChange(idx, 'name', e.target.value)}
                className="border p-1 w-full"
              />
            </div>
            <div>
              <label className="block text-sm" htmlFor={`owner-role-${idx}`}>Title/Role</label>
              <input
                id={`owner-role-${idx}`}
                value={o.role}
                onChange={(e) => handleOwnerChange(idx, 'role', e.target.value)}
                className="border p-1 w-full"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-sm" htmlFor={`owner-percent-${idx}`}>% Ownership</label>
              <input
                type="number"
                id={`owner-percent-${idx}`}
                value={o.percent}
                onChange={(e) => handleOwnerChange(idx, 'percent', e.target.value)}
                className="border p-1 w-full"
              />
            </div>
            <div>
              <label className="block text-sm" htmlFor={`owner-email-${idx}`}>Email</label>
              <input
                id={`owner-email-${idx}`}
                type="email"
                value={o.email}
                onChange={(e) => handleOwnerChange(idx, 'email', e.target.value)}
                className="border p-1 w-full"
              />
            </div>
            <div>
              <label className="block text-sm" htmlFor={`owner-phone-${idx}`}>Phone</label>
              <input
                id={`owner-phone-${idx}`}
                value={o.phone}
                onChange={(e) => handleOwnerChange(idx, 'phone', e.target.value)}
                className="border p-1 w-full"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addOwner}
        className="px-2 py-1 bg-gray-200 rounded"
      >
        Add Owner/Officer
      </button>

      <h3 className="text-xl font-semibold">Compliance</h3>
      <div>
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            name="complianceCertify"
            checked={form.complianceCertify}
            onChange={handleChange}
            className="mr-2"
          />
          I certify this business complies with Equal Opportunity and Nondiscrimination requirements.
        </label>
      </div>
      {form.complianceCertify && renderEeoOfficer()}

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

