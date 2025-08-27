const ALWAYS_REQUIRED = [
  "Tax Returns (last 2–3 years)",
  "Payroll Records (Form 941 / W-2)",
  "Bank Statements (last 3–6 months)",
  "Business License / Incorporation Docs",
  "Owner ID (Driver’s License / Passport)",
  "Ownership / Officer List (≥20% shareholders / officers)",
  "Financial Statements (P&L + Balance Sheet)",
];

function hasEligibility(caseObj, name) {
  const list = caseObj?.eligibility?.results || caseObj?.eligibility || [];
  return Array.isArray(list) && list.some((r) => r.name === name);
}

function getRequiredDocuments(caseObj = {}) {
  const req = new Set(ALWAYS_REQUIRED);
  const q = caseObj.questionnaire?.data || {};
  const fields = caseObj.analyzer?.fields || caseObj.analyzerFields || {};

  const employees = Number(q.employees || q.numberOfEmployees || fields.employees || 0);
  if (employees > 0 || hasEligibility(caseObj, "ERC")) {
    req.add("Quarterly revenue statements (2020–2021)");
    req.add("Government shutdown orders (if applicable)");
  }

  if (q.ownerVeteran || q.ownerSpouseVeteran) {
    req.add("DD214 (Proof of Veteran Status)");
    if (q.ownerSpouseVeteran) {
      req.add("Marriage certificate (if spouse)");
    }
  }

  const minorityEthnicities = [
    "Black",
    "Hispanic",
    "Native American",
    "Asian",
    "Other Minority",
  ];
  if (
    q.ownerGender === "Female" ||
    minorityEthnicities.includes(q.ownerEthnicity)
  ) {
    req.add("Certification (if available)");
    req.add("Ownership docs (Operating Agreement, Cap Table)");
  }

  if (q.ruralArea || q.isRural) {
    req.add("Proof of business address (Lease / Utility Bill)");
    req.add("Census/USDA map extract");
  }

  if (q.opportunityZone || q.isOpportunityZone) {
    req.add("Lease or Utility Bill at OZ address");
    req.add("IRS Form 8996 (if exists)");
  }

  if (
    q.revenueDrop ||
    q.revenueDropPercent ||
    fields.revenue_drop_2020_pct ||
    fields.revenue_drop_2021_pct ||
    q.govShutdown ||
    q.shutdown ||
    fields.shutdown_2020 === 'yes' ||
    fields.shutdown_2021 === 'yes'
  ) {
    req.add("Comparative revenue statements (before/after drop)");
    req.add("Local/state shutdown orders");
  }

  return Array.from(req);
}

module.exports = { getRequiredDocuments, ALWAYS_REQUIRED };
