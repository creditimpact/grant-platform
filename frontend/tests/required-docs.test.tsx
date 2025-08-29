import { render } from "@testing-library/react";
import RequiredDocs from "../src/components/RequiredDocs";

test("renders Tax_Payment_Receipt preview", () => {
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
  ];
  const { container } = render(<RequiredDocs items={items} />);
  expect(container).toMatchSnapshot();
});
