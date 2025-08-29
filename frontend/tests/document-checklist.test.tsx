import { render, screen } from "@testing-library/react";
import DocumentChecklist from "@/components/DocumentChecklist";
import { api } from "@/lib/apiClient";

jest.mock("@/lib/apiClient", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

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
