import { render, screen } from '@testing-library/react';
import Dashboard from '@/app/dashboard/page';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

(test as any).timeout?.(10000);

describe('Dashboard', () => {
  it('renders programs and hints', async () => {
    (api.getStatus as jest.Mock).mockResolvedValue({
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
    expect(await screen.findByText('Program A')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText(/Next: Do something/)).toBeInTheDocument();
  });
});
