import { act, fireEvent, render, screen } from "@testing-library/react";
import DocumentChecklist from "@/components/DocumentChecklist";
import { api, uploadFile } from "@/lib/apiClient";

jest.mock("@/lib/apiClient", () => ({
  api: {
    get: jest.fn(),
  },
  uploadFile: jest.fn(),
}));

beforeEach(() => {
  (api.get as jest.Mock).mockReset();
  (uploadFile as jest.Mock).mockReset();
  localStorage.clear();
});

test("renders and dedupes documents", async () => {
  localStorage.setItem("preupload_done_123", "1");
  (api.get as jest.Mock).mockResolvedValue({
    data: [
      {
        doc_type: "W9",
        source: "common",
        grants: [],
        status: "not_uploaded",
        description: "W9 form",
        example_url: "http://example.com/w9",
      },
      {
        doc_type: "IRS_941X",
        source: "grant",
        grants: ["GrantA"],
        status: "approved",
        description: "Form 941-X",
        example_url: "http://example.com/941",
      },
      {
        doc_type: "IRS_941X",
        source: "grant",
        grants: ["GrantB"],
        status: "approved",
        description: "Form 941-X",
        example_url: "http://example.com/941",
      },
    ],
  });

  render(<DocumentChecklist caseId="123" />);

  expect(await screen.findByText("W9")).toBeInTheDocument();
  expect(await screen.findByText("IRS_941X")).toBeInTheDocument();
  expect(screen.getAllByText("IRS_941X")).toHaveLength(1);
  expect(screen.getByText("Required by: GrantA, GrantB")).toBeInTheDocument();
});

test("uploads document and refreshes status", async () => {
  localStorage.setItem("preupload_done_case123", "1");
  (api.get as jest.Mock)
    .mockResolvedValueOnce({
      data: [
        {
          doc_type: "W9",
          source: "common",
          grants: [],
          status: "not_uploaded",
        },
      ],
    })
    .mockResolvedValueOnce({
      data: [
        {
          doc_type: "W9",
          source: "common",
          grants: [],
          status: "uploaded",
        },
      ],
    });
  (uploadFile as jest.Mock).mockImplementation(async () => {
    window.dispatchEvent(
      new CustomEvent("eligibility-changed", { detail: { caseId: "case123" } }),
    );
    return {};
  });

  render(<DocumentChecklist caseId="case123" />);

  const input = (await screen.findByText("W9"))
    .closest("li")!
    .querySelector("input[type=file]") as HTMLInputElement;

  const file = new File(["dummy"], "w9.pdf", { type: "application/pdf" });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });

  expect(uploadFile).toHaveBeenCalledWith(expect.any(FormData));
  const form = (uploadFile as jest.Mock).mock.calls[0][0] as FormData;
  expect(form.get("caseId")).toBe("case123");
  expect(form.get("key")).toBe("W9");

  expect(await screen.findByText("uploaded")).toBeInTheDocument();
  expect((api.get as jest.Mock)).toHaveBeenCalledTimes(2);
});

test('refreshes when eligibility changes', async () => {
  localStorage.setItem('preupload_done_abc', '1');
  (api.get as jest.Mock)
    .mockResolvedValueOnce({
      data: [
        { doc_type: 'W9', source: 'common', grants: [], status: 'not_uploaded' },
      ],
    })
    .mockResolvedValueOnce({
      data: [
        { doc_type: 'W9', source: 'common', grants: [], status: 'uploaded' },
      ],
    });

  render(<DocumentChecklist caseId="abc" />);
  expect(await screen.findByText('W9')).toBeInTheDocument();

  act(() => {
    window.dispatchEvent(
      new CustomEvent('eligibility-changed', { detail: { caseId: 'abc' } }),
    );
  });

  expect(await screen.findByText('uploaded')).toBeInTheDocument();
  expect((api.get as jest.Mock)).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Your required documents have been updated',
  );
});
