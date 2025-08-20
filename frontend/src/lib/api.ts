import axios from 'axios';
import { normalizeEligibility } from './normalize';
import type { CaseSnapshot, EligibilityReport, ResultsEnvelope } from './types';

const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${base.replace(/\/+$/, '')}/api`,
});

export async function getStatus(caseId?: string): Promise<CaseSnapshot> {
  const url = caseId ? `/status/${caseId}` : '/case/status';
  const res = await api.get(url);
  return transformCase(res.data);
}

export async function uploadFile(formData: FormData): Promise<CaseSnapshot> {
  const res = await api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return transformCase(res.data);
}

export async function postQuestionnaire(payload: {
  caseId?: string;
  answers: Record<string, any>;
}): Promise<CaseSnapshot> {
  const res = await api.post('/questionnaire', payload);
  return transformCase(res.data);
}

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

  if (Array.isArray(data)) {
    return normalizeEligibility(data);
  }
  const envelope = data as ResultsEnvelope;
  if (Array.isArray(envelope.results)) {
    envelope.results = normalizeEligibility(envelope.results);
  } else {
    envelope.results = [];
  }
  return envelope;
}

function transformCase(data: any): CaseSnapshot {
  const raw = Array.isArray(data.eligibility?.results)
    ? data.eligibility.results
    : data.eligibility;
  return {
    caseId: data.caseId,
    status: data.status,
    documents: data.documents,
    analyzerFields: data.analyzerFields || data.analyzer?.fields,
    questionnaire: data.questionnaire,
    eligibility: normalizeEligibility(raw),
    generatedForms: data.generatedForms,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

