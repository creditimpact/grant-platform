import { render, screen, fireEvent } from "@testing-library/react";
import PreUploadWizard from "@/components/PreUploadWizard";

it("renders common docs and continues", () => {
  const onContinue = jest.fn();
  render(<PreUploadWizard onContinue={onContinue} />);

  expect(screen.getByText("IRS W-9")).toBeInTheDocument();
  expect(screen.getByText("EIN Letter (CP-575)")).toBeInTheDocument();
  expect(
    screen.getByText("Basic Financials (P&L / Balance Sheet)")
  ).toBeInTheDocument();
  expect(
    screen.getByText("Basic Tax Return (1120 / Schedule C)")
  ).toBeInTheDocument();
  expect(
    screen.getByText("Bank Statements (3–6 months)")
  ).toBeInTheDocument();

  fireEvent.click(screen.getByText(/continue/i));
  expect(onContinue).toHaveBeenCalled();
});
