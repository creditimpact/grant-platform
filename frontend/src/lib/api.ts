import axios from 'axios';
import { normalizeEligibility } from './normalize';
import type { CaseSnapshot, EligibilityReport, ResultsEnvelope } from './types';

const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${base.replace(/\/+$/, '')}/api`,
});

// -------------------- STATUS --------------------
export async function getStatus(caseId?: string): Promise<CaseSnapshot> {
  const url = caseId ? `/status/${caseId}` : '/case/status';
  const res = await api.get(url);
  return transformCase(res.data);
}

// -------------------- FILE UPLOAD --------------------
export async function uploadFile(formData: FormData): Promise<CaseSnapshot> {
  const res = await api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
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
<<<<<<< HEAD
  const data = (await r.json()) as any;

  // Legacy: API returned raw array
  if (Array.isArray(data)) {
    return {
      results: normalizeEligibility(data),
      requiredForms: [],
    } as EligibilityReport;
  }

  // Envelope style
  const envelope: any = { ...data };
=======
  const data = await r.json();

  if (Array.isArray(data)) {
    return normalizeEligibility(data);
  }
  const envelope = data as ResultsEnvelope;
>>>>>>> 9db82df860434f10a0084994116afaa34ab32f31
  if (Array.isArray(envelope.results)) {
    envelope.results = normalizeEligibility(envelope.results);
  } else {
    envelope.results = [];
  }
<<<<<<< HEAD
  if (!Array.isArray(envelope.requiredForms)) {
    envelope.requiredForms = [];
  }
  return envelope as EligibilityReport;
=======
  return envelope;
>>>>>>> 9db82df860434f10a0084994116afaa34ab32f31
}

// -------------------- TRANSFORM CASE --------------------
function transformCase(data: any): CaseSnapshot {
  const rawResults =
    Array.isArray(data.eligibility?.results)
      ? data.eligibility.results
      : Array.isArray(data.eligibility)
      ? data.eligibility
      : [];

  return {
    caseId: data.caseId,
    status: data.status,
<<<<<<< HEAD
    documents: data.documents || [],
    analyzerFields: data.analyzerFields || data.analyzer?.fields || {},
    questionnaire: data.questionnaire || {},
    eligibility: rawResults.length ? normalizeEligibility(rawResults) : [],
    generatedForms: data.generatedForms || [],
=======
    documents: data.documents,
    analyzerFields: data.analyzerFields || data.analyzer?.fields,
    questionnaire: data.questionnaire,
    eligibility: normalizeEligibility(raw),
    generatedForms: data.generatedForms,
>>>>>>> 9db82df860434f10a0084994116afaa34ab32f31
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
