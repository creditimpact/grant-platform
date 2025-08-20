import { render, screen, fireEvent } from '@testing-library/react';
import EligibilityReport from '@/app/eligibility-report/page';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

(test as any).timeout?.(10000);

describe('EligibilityReport', () => {
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
