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
  rationale?: string[];
  reasoning?: string[];
  next_steps?: string;
  requiredForms?: string[];
}

export interface EligibilitySnapshot {
  results: EligibilityItem[];
  requiredForms: string[];
  lastUpdated: string;
}

export interface CaseSnapshot {
  caseId: string;
  status: CaseStatus;
  documents?: CaseDoc[];
  analyzer?: { fields?: Record<string, any>; lastUpdated?: string };
  questionnaire?: { data?: Record<string, any>; lastUpdated?: string };
  eligibility?: EligibilitySnapshot;
  generatedForms?: Array<{ formName: string; payload: any; files?: string[]; generatedAt: string }>;
  createdAt?: string;
  updatedAt?: string;
}

