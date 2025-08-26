import { render, screen } from '@testing-library/react';
import SummaryStep from '@/app/dashboard/_steps/SummaryStep';
import type { CaseSnapshot } from '@/lib/types';

describe('SummaryStep', () => {
  it('shows estimated amount and draft form link', () => {
    const snapshot: CaseSnapshot = {
      caseId: 'c1',
      documents: [],
      eligibility: [
        {
          name: 'ERC',
          eligible: true,
          missing_fields: [],
          estimated_amount: 25000,
          generatedForms: [
            {
              name: '941-X draft',
              url: 'https://example.com/forms/941x.pdf',
            },
          ],
        },
      ],
    };

    render(<SummaryStep snapshot={snapshot} onRestart={() => {}} />);

    expect(screen.getByText('$25,000')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /941-X draft/i });
    expect(link).toHaveAttribute('href', 'https://example.com/forms/941x.pdf');
  });
});
