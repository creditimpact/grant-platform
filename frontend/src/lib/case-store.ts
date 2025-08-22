import { create } from 'zustand';

interface CaseState {
  caseId: string | null;
  setCaseId: (id: string) => void;
  clearCaseId: () => void;
}

export const useCaseStore = create<CaseState>((set) => ({
  caseId: null,
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


