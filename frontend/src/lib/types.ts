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
  requiredDocuments?: string[];
  eligibility_percent?: number;
  status?: 'eligible' | 'conditional' | 'ineligible';
  rationale?: string;
  certainty_level?: number;
  generatedForms?: GeneratedForm[];
}

export interface GeneratedForm {
  formId: string;
  name: string;
  url: string;
  version?: string;
}

export interface IncompleteForm {
  formId: string;
  name: string;
  missingFields: string[];
  message?: string;
}

export interface CaseSnapshot {
  caseId: string | null;
  requiredForms?: string[];
  requiredDocuments?: string[];
  pendingForms?: string[];
  missingDocuments?: string[];
  status?: CaseStatus;
  documents?: CaseDoc[];
  analyzerFields?: Record<string, unknown>;
  questionnaire?: {
    data?: Record<string, any>;
    missingFieldsHint?: string[];
    lastUpdated?: string;
  };
  eligibility?: EligibilityItem[];
  generatedForms?: GeneratedForm[];
  incompleteForms?: IncompleteForm[];
  createdAt?: string;
  updatedAt?: string;
}

export type ResultsEnvelope = {
  results: EligibilityItem[];
  requiredForms: string[];
  requiredDocuments: string[];
};

export type EligibilityReport = ResultsEnvelope | EligibilityItem[];

