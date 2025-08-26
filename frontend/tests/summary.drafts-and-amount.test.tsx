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
              formId: '941-X',
              name: '941-X draft',
              url: 'https://example.com/forms/941x.pdf',
            },
          ],
        },
      ],
    };

    render(<SummaryStep snapshot={snapshot} onRestart={() => {}} />);

    expect(screen.getByText('$25,000')).toBeInTheDocument();
    const link = screen.getByRole('link', {
      name: /view draft \(941-x draft\)/i,
    });
    expect(link).toHaveAttribute(
      'href',
      'https://example.com/forms/941x.pdf',
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows fallback when url missing', () => {
    const snapshot: CaseSnapshot = {
      caseId: 'c1',
      documents: [],
      eligibility: [
        {
          name: 'ERC',
          eligible: true,
          missing_fields: [],
          generatedForms: [
            { formId: '941-X', name: '941-X draft', url: '' },
          ],
        },
      ],
    };

    render(<SummaryStep snapshot={snapshot} onRestart={() => {}} />);

    expect(screen.getByText(/Draft unavailable/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: /view draft \(941-x draft\)/i,
      }),
    ).toBeNull();
  });
});
