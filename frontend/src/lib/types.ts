export type CaseStatus = 'open' | 'submitted' | 'processing' | 'complete' | 'error';

export interface CaseDoc {
  key?: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

export interface EligibilityItem {
  name: string;
  eligible: boolean | null;
  score?: number;
  estimated_amount?: number;
  missing_fields?: string[];
  next_steps?: string;
  requiredForms?: string[];
  reasoning?: string[] | string;
  rationale?: string[];
}

export interface CaseSnapshot {
  caseId: string;
  status?: CaseStatus;
  documents?: CaseDoc[];
  analyzerFields?: Record<string, unknown>;
  questionnaire?: { data?: Record<string, any>; lastUpdated?: string };
  eligibility?: EligibilityItem[];
  generatedForms?: Array<{ name: string; status?: string; link?: string }>;
  createdAt?: string;
  updatedAt?: string;
}

