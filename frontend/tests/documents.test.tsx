import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Documents from '@/app/dashboard/documents/page';
import * as api from '@/lib/apiClient';

jest.mock('@/lib/apiClient');

(test as any).timeout?.(10000);

describe('Documents page', () => {
  it('uploads file and shows in list', async () => {
    (api.getStatus as jest.Mock).mockResolvedValue({
      caseId: 'c1',
      documents: [],
      analyzerFields: {},
    });
    const afterUpload = {
      caseId: 'c1',
      documents: [
        { filename: 'a.pdf', size: 1, contentType: 'application/pdf', uploadedAt: 'now' },
      ],
      analyzerFields: { a: 1 },
    };
    (api.uploadFile as jest.Mock).mockResolvedValue(afterUpload);
    const { container } = render(<Documents />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['hi'], 'a.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(api.uploadFile).toHaveBeenCalled());
    expect(await screen.findByText('a.pdf')).toBeInTheDocument();
  });
});
