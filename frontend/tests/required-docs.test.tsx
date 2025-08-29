import { render } from "@testing-library/react";
import RequiredDocs from "../src/components/RequiredDocs";

test("renders doc previews", () => {
  const items = [
    {
      key: "Tax_Payment_Receipt",
      label: "Tax Payment Receipt / Payment Confirmation",
      uploads: [
        {
          fields: {
            confirmation_number: "ABC12345",
            payment_amount: 1234.56,
            payment_date: "2023-04-15",
          },
        },
      ],
    },
    {
      key: "IRS_941X",
      label: "IRS Form 941-X (Adjusted Quarterly Return)",
      uploads: [
        { fields: { ein: "123456789", year: "2021", quarter: "1" } },
      ],
    },
  ];
  const { container } = render(<RequiredDocs items={items} />);
  expect(container).toMatchSnapshot();
});
