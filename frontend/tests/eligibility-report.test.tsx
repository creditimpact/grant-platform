import { render, screen, fireEvent } from '@testing-library/react';
import EligibilityReport from '@/app/eligibility-report/page';
import { setCaseId, clearCaseId } from '@/lib/case-store';
import * as api from '@/lib/apiClient';

jest.mock('@/lib/apiClient');

(test as any).timeout?.(10000);

describe('EligibilityReport', () => {
  beforeEach(() => {
    clearCaseId();
    setCaseId('c1');
  });

  it('shows generating indicator', async () => {
    (api.getStatus as jest.Mock).mockResolvedValue({ caseId: 'c1', eligibility: [] });
    let resolve: any;
    (api.postEligibilityReport as jest.Mock).mockImplementation(
      () =>
        new Promise((res) => {
          resolve = res;
        })
    );
    render(<EligibilityReport />);
    const btn = await screen.findByText('Generate report & required forms');
    fireEvent.click(btn);
    expect(screen.getByText('Generating forms...')).toBeInTheDocument();
    resolve({ caseId: 'c1', eligibility: [] });
  });
});
