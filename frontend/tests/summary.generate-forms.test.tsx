import { render, screen, fireEvent } from '@testing-library/react';
import SummaryStep from '@/app/dashboard/_steps/SummaryStep';
import type { CaseSnapshot } from '@/lib/types';
import * as api from '@/lib/apiClient';

jest.mock('@/lib/apiClient');

describe('SummaryStep generate forms', () => {
  it('generates forms when button clicked', async () => {
    (api.postFormFill as jest.Mock).mockResolvedValue({
      generatedForms: [
        { formId: '941-X', name: '941-X draft', url: 'https://example.com/941x.pdf' },
      ],
    });
    const snapshot: CaseSnapshot = {
      caseId: 'c1',
      requiredForms: ['941-X'],
      generatedForms: [],
      documents: [],
      eligibility: [],
    };
    render(<SummaryStep snapshot={snapshot} onRestart={() => {}} />);
    const btn = screen.getByRole('button', { name: /generate forms/i });
    fireEvent.click(btn);
    expect(api.postFormFill).toHaveBeenCalledWith('c1', ['941-X']);
    const link = await screen.findByRole('link', {
      name: /view draft \(941-x draft\)/i,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows error on failure', async () => {
    (api.postFormFill as jest.Mock).mockRejectedValue(new Error('bad'));
    const snapshot: CaseSnapshot = {
      caseId: 'c1',
      requiredForms: ['941-X'],
      generatedForms: [],
      documents: [],
      eligibility: [],
    };
    render(<SummaryStep snapshot={snapshot} onRestart={() => {}} />);
    const btn = screen.getByRole('button', { name: /generate forms/i });
    fireEvent.click(btn);
    await screen.findByRole('alert');
    expect(btn).not.toBeDisabled();
  });
});

