import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from '@/app/dashboard/page';
import { getCaseId, clearCaseId } from '@/lib/case-store';
import * as api from '@/lib/apiClient';

jest.mock('@/lib/apiClient');

(test as any).timeout?.(10000);

describe('Dashboard', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    clearCaseId();
    (api.getStatus as jest.Mock).mockResolvedValue({ caseId: null, status: 'empty' });
  });

  it('shows start button on fresh load', async () => {
    render(<Dashboard />);
    expect(await screen.findByText('Start Application')).toBeInTheDocument();
    expect(screen.queryByText('Resume Application')).not.toBeInTheDocument();
  });

  it('starts a new application', async () => {
    (api.initCase as jest.Mock).mockResolvedValue({
      caseId: 'c1',
      status: 'open',
      analyzerFields: {},
      eligibility: [],
    });

    render(<Dashboard />);
    const start = await screen.findByText('Start Application');
    fireEvent.click(start);
    expect(await screen.findByText(/Case ID: c1/)).toBeInTheDocument();
    expect(getCaseId()).toBe('c1');
  });

  it('resumes a saved application', async () => {
    localStorage.setItem('caseId', 'c1');
    (api.getStatus as jest.Mock).mockResolvedValueOnce({ caseId: null, status: 'empty' });
    (api.getStatus as jest.Mock).mockResolvedValueOnce({
      caseId: 'c1',
      status: 'open',
      analyzerFields: { field1: 'value' },
      eligibility: [
        {
          name: 'Program A',
          eligible: true,
          missing_fields: ['foo'],
          next_steps: 'Do something',
        },
      ],
    });

    render(<Dashboard />);
    const resume = await screen.findByText('Resume Application');
    fireEvent.click(resume);
    expect(await screen.findByText(/Case ID: c1/)).toBeInTheDocument();
    expect(getCaseId()).toBe('c1');
    expect(screen.getByText('Program A')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText(/Next: Do something/)).toBeInTheDocument();
  });
});

