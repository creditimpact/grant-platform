import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '@/app/dashboard/page';
import { clearCaseId } from '@/lib/case-store';
import * as api from '@/lib/apiClient';

jest.mock('@/lib/apiClient');

describe('Dashboard wizard', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    clearCaseId();
    (api.getStatus as jest.Mock).mockResolvedValue({ caseId: null, status: 'empty' });
    (api.getRequiredDocuments as jest.Mock).mockResolvedValue([]);
  });

  it('advances from start to upload after questionnaire', async () => {
    (api.initCase as jest.Mock).mockResolvedValue({
      caseId: 'c1',
      documents: [],
      questionnaire: {},
      eligibility: [],
    });
    (api.postQuestionnaire as jest.Mock).mockResolvedValue({
      caseId: 'c1',
      documents: [],
      questionnaire: { lastUpdated: 'now', data: {} },
      eligibility: [],
    });

    render(<Dashboard />);
    const start = await screen.findByRole('button', { name: 'Start Application' });
    fireEvent.click(start);

    expect(await screen.findByRole('heading', { name: 'Questionnaire' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Legal Business Name'), { target: { value: 'Biz LLC' } });
    fireEvent.change(screen.getByLabelText('Entity Type'), { target: { value: 'LLC' } });
    fireEvent.change(screen.getByLabelText('EIN'), { target: { value: '123456789' } });
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Owner One' } });
    fireEvent.click(screen.getByLabelText(/I certify this business/));

    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(api.postQuestionnaire).toHaveBeenCalled());

    expect(await screen.findByText('Upload Documents')).toBeInTheDocument();
  });
});
