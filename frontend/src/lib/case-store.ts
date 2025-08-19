import { create } from 'zustand';

interface CaseState {
  caseId?: string;
  setCaseId: (id: string) => void;
  clearCaseId: () => void;
}

export const useCaseStore = create<CaseState>((set) => ({
  caseId: undefined,
  setCaseId: (id: string) => {
    set({ caseId: id });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('caseId', id);
      } catch {}
    }
  },
  clearCaseId: () => {
    set({ caseId: undefined });
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('caseId');
      } catch {}
    }
  },
}));

export function getCaseId(): string | undefined {
  const { caseId } = useCaseStore.getState();
  if (caseId) return caseId;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('caseId');
      if (stored) {
        useCaseStore.setState({ caseId: stored });
        return stored;
      }
    } catch {}
  }
  return undefined;
}

export function setCaseId(id: string) {
  useCaseStore.getState().setCaseId(id);
}

export function clearCaseId() {
  useCaseStore.getState().clearCaseId();
}

// Initialize from localStorage on the client
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('caseId');
    if (stored) {
      useCaseStore.setState({ caseId: stored });
    }
  } catch {}
}

