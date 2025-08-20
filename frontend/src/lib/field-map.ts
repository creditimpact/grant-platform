// Maps API (snake_case) → UI (camelCase) and vice versa.
export const apiToUi: Record<string, string> = {
  business_type: 'businessType',
  number_of_employees: 'numberOfEmployees',
  ownership_percentage: 'ownershipPercentage',
  incorporation_date: 'incorporationDate',
  service_area_population: 'serviceAreaPopulation',
  location_zone: 'locationZone',
  project_type: 'projectType',
  project_cost: 'projectCost',
  project_state: 'projectState',
  annual_revenue: 'annualRevenue',
  net_profit: 'netProfit',
  business_income: 'businessIncome',
  business_expenses: 'businessExpenses',
  tax_paid: 'taxPaid',
  tax_year: 'taxYear',
  previous_grants: 'previousGrants',
  previous_refunds_claimed: 'previousRefundsClaimed',
  ein: 'ein',
  ssn: 'ssn',
  sam: 'sam',
  cage_code: 'cageCode',
  duns: 'duns',
  state: 'state',
  zip: 'zip',
  // add more as you see in API payloads
};

export const uiToApi: Record<string, string> = Object.fromEntries(
  Object.entries(apiToUi).map(([k, v]) => [v, k])
);

// Convert snake_case to camelCase if missing above
export const snakeToCamel = (s: string) =>
  s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// Normalize options from analyzer to UI selects (e.g., 'llc' → 'LLC')
export const normalizeBusinessTypeForUI = (val?: string) => {
  if (!val) return '';
  const v = val.trim().toLowerCase();
  if (['llc'].includes(v)) return 'LLC';
  if (['sole', 'sole-prop', 'sole proprietorship'].includes(v)) return 'Sole';
  if (['partnership'].includes(v)) return 'Partnership';
  if (['corp', 'corporation', 'c-corp', 's-corp', 's corporation'].includes(v)) return 'Corporation';
  return '';
};

// Normalize dates to YYYY-MM-DD if they look like dd/MM/yyyy or MM/dd/yyyy
export const toIsoDateYMD = (val?: string): string | undefined => {
  if (!val) return undefined;
  const v = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [_, a, b, yyyy] = slash;
    // Best-effort: assume dd/MM or MM/dd based on >12 day/month heuristics
    const d = parseInt(a, 10);
    const m = parseInt(b, 10);
    const dayFirst = d > 12 || (d <= 12 && m <= 12 ? false : true);
    const day = String(dayFirst ? d : m).padStart(2, '0');
    const month = String(dayFirst ? m : d).padStart(2, '0');
    return `${yyyy}-${month}-${day}`;
  }
  return v; // leave as-is
};
