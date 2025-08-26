import axios from 'axios';
import { normalizeEligibility } from './normalize';
import type {
  CaseSnapshot,
  EligibilityReport,
  GeneratedForm,
  ResultsEnvelope,
} from './types';

const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${base.replace(/\/+$/, '')}/api`,
});

export async function getStatus(caseId?: string | null): Promise<CaseSnapshot> {
  if (!caseId) {
    return { caseId: null, status: 'empty' };
  }
  const url = `/case/status?caseId=${caseId}`;
  const res = await api.get(url);
  return transformCase(res.data);
}

export async function initCase(): Promise<CaseSnapshot> {
  const res = await api.post('/case/init');
  return transformCase(res.data);
}

export async function getRequiredDocuments(caseId: string): Promise<string[]> {
  const res = await api.get(`/case/required-documents?caseId=${caseId}`);
  return res.data.required;
}

// -------------------- FILE UPLOAD --------------------
export async function uploadFile(formData: FormData): Promise<CaseSnapshot> {
  const res = await api.post('/files/upload', formData);
  return transformCase(res.data);
}

// -------------------- QUESTIONNAIRE --------------------
export async function postQuestionnaire(payload: {
  caseId?: string;
  answers: Record<string, any>;
}): Promise<CaseSnapshot> {
  const res = await api.post('/questionnaire', payload);
  return transformCase(res.data);
}

// -------------------- ELIGIBILITY REPORT --------------------
export async function postEligibilityReport(payload: {
  caseId: string;
}): Promise<CaseSnapshot> {
  const res = await api.post('/eligibility-report', payload);
  return transformCase(res.data);
}

export async function getEligibilityReport(caseId?: string): Promise<EligibilityReport> {
  const r = await fetch(
    `/api/eligibility-report${caseId ? `?caseId=${caseId}` : ''}`,
    { cache: 'no-store' }
  );
  if (!r.ok) throw new Error(`eligibility-report ${r.status}`);

  const data = await r.json();

  // Legacy: API returned raw array
  if (Array.isArray(data)) {
    return {
      results: normalizeEligibility(data),
      requiredForms: [],
    } as EligibilityReport;
  }

  // Envelope style
  const envelope = data as ResultsEnvelope;
  if (Array.isArray(envelope.results)) {
    envelope.results = normalizeEligibility(envelope.results);
  } else {
    envelope.results = [];
  }
  if (!Array.isArray(envelope.requiredForms)) {
    envelope.requiredForms = [];
  }
  return envelope as EligibilityReport;
}

// -------------------- FORM FILL --------------------
export interface PostFormFillResponse {
  generatedForms: GeneratedForm[];
}

export async function postFormFill(
  caseId: string,
  forms: string[],
): Promise<PostFormFillResponse> {
  const res = await fetch('/api/case/form-fill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId, forms }),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `form-fill failed (${res.status})`);
  }
  const data = await res.json();
  return { generatedForms: toGeneratedForms(data.generatedForms) };
}

// -------------------- TRANSFORM CASE --------------------
function toGeneratedForms(arr: any): GeneratedForm[] {
  return (Array.isArray(arr) ? arr : []).map((f: any) => ({
    formId: f.formId ?? f.formKey ?? '',
    name: f.name ?? f.formId ?? f.formKey ?? '',
    url: f.url ?? f.link ?? '',
    version: f.version ?? f.formVersion ?? undefined,
  }));
}

function transformCase(data: any): CaseSnapshot {
  const rawResults =
    Array.isArray(data.eligibility?.results)
      ? data.eligibility.results
      : Array.isArray(data.eligibility)
      ? data.eligibility
      : [];

  const questionnaire = {
    data: data.questionnaire?.data || {},
    missingFieldsHint: data.questionnaire?.missingFieldsHint || [],
    lastUpdated: data.questionnaire?.lastUpdated,
  };

  return {
    caseId: data.caseId,
    requiredForms: Array.isArray(data.requiredForms) ? data.requiredForms : undefined,
    status: data.status,
    documents: data.documents || [],
    analyzerFields: data.analyzerFields || data.analyzer?.fields || {},
    questionnaire,
    eligibility: rawResults.length ? normalizeEligibility(rawResults) : [],
    generatedForms: toGeneratedForms(data.generatedForms),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
