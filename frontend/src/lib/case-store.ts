import { create } from 'zustand';

export enum FlowStep {
  Start = 0,
  Questionnaire = 1,
  Upload = 2,
  Eligibility = 3,
  Summary = 4,
}

interface CaseState {
  caseId: string | null;
  currentStep: FlowStep;
  completed: Record<FlowStep, boolean>;
  setCaseId: (id: string) => void;
  clearCaseId: () => void;
  setStep: (step: FlowStep) => void;
  markDone: (step: FlowStep) => void;
  reset: () => void;
}

export const useCaseStore = create<CaseState>((set, get) => ({
  caseId: null,
  currentStep: FlowStep.Start,
  completed: {},
  setCaseId: (id: string) => {
    set({ caseId: id });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('caseId', id);
      } catch {}
    }
  },
  clearCaseId: () => {
    set({ caseId: null });
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('caseId');
      } catch {}
    }
  },
  setStep: (step: FlowStep) => {
    const { currentStep } = get();
    if (step > currentStep + 1) return; // guard skipping ahead
    set({ currentStep: step });
  },
  markDone: (step: FlowStep) =>
    set((state) => ({ completed: { ...state.completed, [step]: true } })),
  reset: () => {
    set({ caseId: null, currentStep: FlowStep.Start, completed: {} });
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('caseId');
      } catch {}
    }
  },
}));

export function getCaseId(loadFromStorage = false): string | null {
  const { caseId } = useCaseStore.getState();
  if (caseId) return caseId;
  if (loadFromStorage && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('caseId');
      if (stored) {
        useCaseStore.setState({ caseId: stored });
        return stored;
      }
    } catch {}
  }
  return null;
}

export function setCaseId(id: string) {
  useCaseStore.getState().setCaseId(id);
}

export function clearCaseId() {
  useCaseStore.getState().clearCaseId();
}


