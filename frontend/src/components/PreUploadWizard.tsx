"use client";
import React from "react";

export interface CommonDoc {
  doc_type: string;
  title: string;
  description: string;
  example_url?: string;
}

const COMMON_DOCS: CommonDoc[] = [
  {
    doc_type: "W9_Form",
    title: "IRS Form W-9 (Request for TIN)",
    description:
      "Signed IRS W-9 showing your TIN (SSN/EIN), legal name, entity type, and address.",
    example_url: "https://www.irs.gov/pub/irs-pdf/fw9.pdf",
  },
  {
    doc_type: "EIN_Letter",
    title: "EIN Letter (CP-575)",
    description: "Confirms your business's Employer Identification Number.",
  },
  {
    doc_type: "Basic_Financials",
    title: "Basic Financials (P&L / Balance Sheet)",
    description: "Demonstrates the financial health of your business.",
  },
  {
    doc_type: "Basic_Tax_Return",
    title: "Basic Tax Return (1120 / Schedule C)",
    description: "Verifies reported income and taxes.",
  },
  {
    doc_type: "Bank_Statements",
    title: "Bank Statements (3–6 months)",
    description: "Shows cash flow for the business.",
  },
];

export default function PreUploadWizard({
  onContinue,
}: {
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        Please prepare these common documents before uploading. They are required
        for all grants.
      </p>
      <ul className="space-y-2">
        {COMMON_DOCS.map((doc) => (
          <li key={doc.doc_type} className="border rounded p-3">
            <div className="font-medium">{doc.title}</div>
            <p className="text-sm text-gray-600">{doc.description}</p>
            {doc.example_url && (
              <a
                href={doc.example_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 text-sm underline"
              >
                Example
              </a>
            )}
          </li>
        ))}
      </ul>
      <button
        onClick={onContinue}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Continue
      </button>
    </div>
  );
}

