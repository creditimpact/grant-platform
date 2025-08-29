type Upload = { fields?: any };
type Item = {
  key: string;
  label: string;
  optional?: boolean;
  accept_mime?: string[];
  notes?: string;
  examples?: string[];
  uploads?: Upload[];
};

const LABELS: Record<string, string> = {
  IRS_941X: "IRS Form 941-X (Adjusted Quarterly Return)",
};

export default function RequiredDocs({ items }: { items: Item[] }) {
  return (
    <div className="space-y-3">
      {items.map((i) => {
        const label = LABELS[i.key] || i.label;
        return (
          <div key={i.key} className="rounded-xl border p-4">
            <div className="font-medium">
              {label}{" "}
              {i.optional && (
                <span className="text-sm text-gray-500">(optional)</span>
              )}
            </div>
            {i.uploads && i.uploads.length ? (
              <ul className="text-sm mt-1 space-y-1">
                {i.uploads.slice(0, 3).map((u, idx) => {
                  const f = u.fields || {};
                  let parts: string[] = [];
                  if (i.key === "Tax_Payment_Receipt") {
                    parts = ["Payment Confirmation"];
                    if (typeof f.payment_amount === "number") {
                      parts.push(
                        new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(f.payment_amount)
                      );
                    }
                    if (f.payment_date) parts.push(f.payment_date);
                    if (f.confirmation_number) parts.push(`#${f.confirmation_number}`);
                  } else if (i.key === "IRS_941X") {
                    parts = ["Form 941-X"];
                    if (f.ein) parts.push(`EIN ${f.ein}`);
                    if (f.year) parts.push(f.year);
                    if (f.quarter) parts.push(`Q${f.quarter}`);
                  }
                  return <li key={idx}>{parts.join(" • ")}</li>;
                })}
              </ul>
            ) : (
              <>
                {i.accept_mime && (
                  <div className="text-sm">
                    Accepted: {i.accept_mime.join(", ")}
                  </div>
                )}
                {i.examples?.length ? (
                  <div className="text-sm">
                    Examples: {i.examples.join(" • ")}
                  </div>
                ) : null}
                {i.notes ? (
                  <div className="text-sm text-gray-500">{i.notes}</div>
                ) : null}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
