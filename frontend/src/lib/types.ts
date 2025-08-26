export type CaseStatus =
  | 'empty'
  | 'open'
  | 'submitted'
  | 'processing'
  | 'complete'
  | 'error';

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
  missing_fields: string[];
  estimated_amount?: number;
  reasoning?: string[];
  next_steps?: string;
  requiredForms?: string[];
  eligibility_percent?: number;
  status?: 'eligible' | 'conditional' | 'ineligible';
  rationale?: string;
  certainty_level?: number;
}

export interface CaseSnapshot {
  caseId: string | null;
  status?: CaseStatus;
  documents?: CaseDoc[];
  analyzerFields?: Record<string, unknown>;
  questionnaire?: {
    data?: Record<string, any>;
    missingFieldsHint?: string[];
    lastUpdated?: string;
  };
  eligibility?: EligibilityItem[];
  generatedForms?: Array<{ name: string; status?: string; link?: string }>;
  createdAt?: string;
  updatedAt?: string;
}

export type ResultsEnvelope = {
  results: EligibilityItem[];
  requiredForms: string[];
};

export type EligibilityReport = ResultsEnvelope | EligibilityItem[];

