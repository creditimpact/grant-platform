import { act, fireEvent, render, screen } from "@testing-library/react";
import DocumentChecklist from "@/components/DocumentChecklist";
import { api } from "@/lib/apiClient";

jest.mock("@/lib/apiClient", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

beforeEach(() => {
  (api.get as jest.Mock).mockReset();
  (api.post as jest.Mock).mockReset();
});

test("renders and dedupes documents", async () => {
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

  (api.post as jest.Mock).mockResolvedValue({});

  render(<DocumentChecklist caseId="case123" />);

  const input = (await screen.findByText("W9"))
    .closest("li")!
    .querySelector("input[type=file]") as HTMLInputElement;

  const file = new File(["dummy"], "w9.pdf", { type: "application/pdf" });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });

  expect(api.post).toHaveBeenCalledWith("/files/upload", expect.any(FormData));
  const form = (api.post as jest.Mock).mock.calls[0][1] as FormData;
  expect(form.get("caseId")).toBe("case123");
  expect(form.get("key")).toBe("W9");

  expect(await screen.findByText("uploaded")).toBeInTheDocument();
  expect((api.get as jest.Mock)).toHaveBeenCalledTimes(2);
});
