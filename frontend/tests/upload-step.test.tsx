import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UploadStep from '@/app/dashboard/_steps/UploadStep';
import * as api from '@/lib/apiClient';
import type { CaseDoc } from '@/lib/types';

jest.mock('@/lib/apiClient');

describe('UploadStep', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders required documents', async () => {
    (api.getRequiredDocuments as jest.Mock).mockResolvedValue([
      'Tax Returns',
      'Payroll Records',
    ]);
    const { asFragment } = render(
      <UploadStep
        caseId="c1"
        docs={[]}
        onUploaded={jest.fn()}
        onNext={jest.fn()}
        onBack={jest.fn()}
      />
    );
    await screen.findByText(/Tax Returns/);
    await screen.findByText(/Payroll Records/);
    expect(asFragment()).toMatchSnapshot();
  });

  it('updates checklist after uploads', async () => {
    (api.getRequiredDocuments as jest.Mock).mockResolvedValue([
      'Tax Returns',
      'Payroll Records',
    ]);
    const docs: CaseDoc[] = [];
    (api.uploadFile as jest.Mock).mockImplementation(async (fd: FormData) => {
      const key = fd.get('key') as string;
      const file = fd.get('file') as File;
      docs.push({
        key,
        filename: file.name,
        size: file.size,
        contentType: file.type,
        uploadedAt: 'now',
      });
      return { caseId: 'c1', documents: docs };
    });
    let rerenderFn: any;
    const handleUploaded = (snap: any) => {
      docs.splice(0, docs.length, ...snap.documents);
      rerenderFn(
        <UploadStep
          caseId="c1"
          docs={docs}
          onUploaded={handleUploaded}
          onNext={jest.fn()}
          onBack={jest.fn()}
        />
      );
    };
    const { rerender } = render(
      <UploadStep
        caseId="c1"
        docs={docs}
        onUploaded={handleUploaded}
        onNext={jest.fn()}
        onBack={jest.fn()}
      />
    );
    rerenderFn = rerender;
    const taxInput = await screen.findByTestId('upload-Tax_Returns');
    const file1 = new File(['a'], 'tax.pdf', { type: 'application/pdf' });
    fireEvent.change(taxInput, { target: { files: [file1] } });
    await waitFor(() => expect(api.uploadFile).toHaveBeenCalled());
    expect(screen.getByText(/Tax Returns/).textContent).toContain('✅');
    const payrollInput = screen.getByTestId('upload-Payroll_Records');
    const file2 = new File(['b'], 'payroll.pdf', { type: 'application/pdf' });
    fireEvent.change(payrollInput, { target: { files: [file2] } });
    await waitFor(() => expect(api.uploadFile).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/Payroll Records/).textContent).toContain('✅');
    const nextBtn = screen.getByText('Next') as HTMLButtonElement;
    await waitFor(() => expect(nextBtn.disabled).toBe(false));
  });
});
