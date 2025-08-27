const { toMMDDYYYY, toNumber, bool, fullName, currency } = require('./normalizeAnswers');

function mapSF424(a, { testMode = false } = {}) {
  const applicant_legal_name = a.legalBusinessName || a.applicant_name;
  const authorized_rep_name = a.authorizedRepSameAsOwner
    ? fullName(a.ownerFirstName, a.ownerLastName)
    : fullName(a.authorizedRepFirstName, a.authorizedRepLastName);
  const authorized_rep_title = a.authorizedRepSameAsOwner
    ? a.ownerTitle
    : a.authorizedRepTitle;

  return {
    applicant_legal_name,
    applicant_name: applicant_legal_name,
    ein: a.ein,
    descriptive_title: a.projectTitle,
    project_start_date: toMMDDYYYY(a.projectStart),
    project_end_date: toMMDDYYYY(a.projectEnd),
    funding_total: currency(a.fundingRequest),
    authorized_rep_name,
    authorized_rep_title,
    authorized_rep_date_signed: testMode
      ? toMMDDYYYY(new Date())
      : undefined,
    address_line1: a.physicalAddress?.street,
    address_city: a.physicalAddress?.city,
    address_state: a.physicalAddress?.state,
    address_zip: a.physicalAddress?.zip,
  };
}

function mapSF424A(a) {
  return {
    object_class_personnel: currency(a.budgetPersonnel),
    object_class_fringe: currency(a.budgetFringe),
    object_class_travel: currency(a.budgetTravel),
    object_class_equipment: currency(a.budgetEquipment),
    object_class_supplies: currency(a.budgetSupplies),
    object_class_contractual: currency(a.budgetContractual),
    object_class_construction: currency(a.budgetConstruction),
    object_class_other: currency(a.budgetOther),
    object_class_indirect: currency(a.budgetIndirect),
    non_federal_share: currency(a.nonFederalShare),
    program_income: currency(a.programIncome),
    cash_needs_q1: currency(a.cashNeedsQ1),
    cash_needs_q2: currency(a.cashNeedsQ2),
    cash_needs_q3: currency(a.cashNeedsQ3),
    cash_needs_q4: currency(a.cashNeedsQ4),
  };
}

function mapRD400Common(a) {
  return {
    applicant_legal_name: a.legalBusinessName,
    ein: a.ein,
    addr_line1: a.physicalAddress?.street,
    addr_city: a.physicalAddress?.city,
    addr_state: a.physicalAddress?.state,
    addr_zip: a.physicalAddress?.zip,
    eeo_officer_name: a.eeoOfficer?.name,
    eeo_officer_email: a.eeoOfficer?.email,
    eeo_officer_phone: a.eeoOfficer?.phone,
    certify_equal_opportunity: bool(a.complianceCertify),
  };
}
function mapRD400_1(a) {
  return mapRD400Common(a);
}
function mapRD400_4(a) {
  return mapRD400Common(a);
}

function mapRD400_8(a) {
  return {
    org_name: a.legalBusinessName,
    reporting_period_start: toMMDDYYYY(a.reportingStart),
    reporting_period_end: toMMDDYYYY(a.reportingEnd),
    workforce_male: toNumber(a.workforceMale),
    workforce_female: toNumber(a.workforceFemale),
    workforce_nonbinary: toNumber(a.workforceNonbinary),
    workforce_hispanic: toNumber(a.workforceHispanic),
    workforce_black: toNumber(a.workforceBlack),
    workforce_asian: toNumber(a.workforceAsian),
    workforce_white: toNumber(a.workforceWhite),
    board_male: toNumber(a.boardMale),
    board_female: toNumber(a.boardFemale),
    board_nonbinary: toNumber(a.boardNonbinary),
  };
}

function map8974(a) {
  return {
    ein: a.ein,
    tax_year: a.taxYear,
    tax_quarter: a.taxQuarter,
    ss_wages: currency(a.socialSecurityWages),
    medicare_wages: currency(a.medicareWages),
    federal_tax_deposits: currency(a.federalTaxDeposits),
    rd_wages_allocated: currency(a.rAndDWagesAllocated),
  };
}

function map6765(a) {
  return {
    ein: a.ein,
    tax_year: a.taxYear,
    qre_wages: currency(a.qreWages),
    qre_supplies: currency(a.qreSupplies),
    qre_contract_research: currency(a.qreContractResearch),
    qre_basic_research: currency(a.qreBasicResearch),
    computer_rental_costs: currency(a.computerRentalCosts),
    gross_receipts_y1: currency(a.grossReceiptsPrev4Years?.[0]),
    gross_receipts_y2: currency(a.grossReceiptsPrev4Years?.[1]),
    gross_receipts_y3: currency(a.grossReceiptsPrev4Years?.[2]),
    gross_receipts_y4: currency(a.grossReceiptsPrev4Years?.[3]),
    fixed_base_pct: toNumber(a.fixedBasePercentage),
    base_amount: currency(a.baseAmount),
    elect_payroll_offset: bool(a.electPayrollOffset),
    carryforward_amount: currency(a.carryforwardAmount),
  };
}

module.exports = {
  mapSF424,
  mapSF424A,
  mapRD400_1,
  mapRD400_4,
  mapRD400_8,
  map8974,
  map6765,
};
