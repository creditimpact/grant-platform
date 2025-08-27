const FormTemplate = require('../models/FormTemplate');

// simple in-memory cache for latest templates
const cache = new Map();

async function getLatestTemplate(key) {
  if (cache.has(key)) return cache.get(key);
  const tmpl = await FormTemplate.findOne({ key }).sort({ version: -1 }).exec();
  if (tmpl) cache.set(key, tmpl);
  return tmpl;
}

async function getTemplate(key, version) {
  return FormTemplate.findOne({ key, version }).exec();
}

function cacheTemplate(doc) {
  if (doc && doc.key) cache.set(doc.key, doc);
}

// mappings for PDF rendering templates
// each entry defines how a given form should be rendered
// using either AcroForm fields or absolute positioning
const pdfTemplates = {
  form_sf424: {
    base: 'form_sf424.pdf',
    mode: 'acro',
    required: [
      'applicant_legal_name',
      'ein',
      'descriptive_title',
      'project_start_date',
      'project_end_date',
      'authorized_rep_name',
      'authorized_rep_title',
      'authorized_rep_date_signed',
      'funding_total',
    ],
    fields: {
      applicant_legal_name: 'SF424.ApplicantName',
      ein: 'SF424.EIN',
      descriptive_title: 'SF424.ProjectTitle',
      project_start_date: 'SF424.StartDate',
      project_end_date: 'SF424.EndDate',
      authorized_rep_name: 'SF424.AuthRepName',
      authorized_rep_title: 'SF424.AuthRepTitle',
      authorized_rep_date_signed: 'SF424.AuthRepDate',
      funding_federal: 'SF424.FundingFederal',
      funding_total: 'SF424.FundingTotal',
    },
    checkboxes: {
      type_of_submission_application: 'SF424.Submission.Application',
      type_of_submission_preapplication: 'SF424.Submission.Preapplication',
      type_of_applicant_code_A: 'SF424.ApplicantType.A',
      type_of_applicant_code_B: 'SF424.ApplicantType.B',
      type_of_applicant_code_C: 'SF424.ApplicantType.C',
      type_of_applicant_code_D: 'SF424.ApplicantType.D',
      type_of_applicant_code_E: 'SF424.ApplicantType.E',
      type_of_applicant_code_F: 'SF424.ApplicantType.F',
      type_of_applicant_code_G: 'SF424.ApplicantType.G',
      type_of_applicant_code_H: 'SF424.ApplicantType.H',
      type_of_applicant_code_I: 'SF424.ApplicantType.I',
      type_of_applicant_code_J: 'SF424.ApplicantType.J',
      type_of_applicant_code_K: 'SF424.ApplicantType.K',
      type_of_applicant_code_L: 'SF424.ApplicantType.L',
      type_of_applicant_code_M: 'SF424.ApplicantType.M',
      type_of_applicant_code_N: 'SF424.ApplicantType.N',
    },
  },
  form_424A: {
    base: 'form_424A.pdf',
    mode: 'absolute',
    coords: {
      applicant_name: { page: 0, x: 50, y: 700, fontSize: 12 },
    },
    required: ['applicant_name'],
  },
  form_RD_400_1: {
    base: 'form_RD_400_1.pdf',
    mode: 'absolute',
    required: [
      'recipient_name',
      'recipient_address_street',
      'recipient_address_city',
      'recipient_address_state',
      'recipient_address_zip',
      'agreement_date',
      'recipient_title',
      'signing_date',
    ],
    coords: {
      recipient_name:           { page: 0, x: 160, y: 700, fontSize: 11 },
      recipient_address_street: { page: 0, x: 160, y: 682, fontSize: 11 },
      recipient_address_city:   { page: 0, x: 160, y: 664, fontSize: 11 },
      recipient_address_state:  { page: 0, x: 390, y: 664, fontSize: 11 },
      recipient_address_zip:    { page: 0, x: 445, y: 664, fontSize: 11 },
      agreement_date:           { page: 0, x: 160, y: 640, fontSize: 11 },

      recipient_signature:      { page: 0, x: 160, y: 210, fontSize: 11 },
      recipient_title:          { page: 0, x: 160, y: 192, fontSize: 11 },
      signing_date:             { page: 0, x: 440, y: 210, fontSize: 11 },
      corporate_recipient_name: { page: 0, x: 160, y: 174, fontSize: 11 },
      president_signature:      { page: 0, x: 160, y: 156, fontSize: 11 },
      secretary_attest:         { page: 0, x: 440, y: 156, fontSize: 11 },
    },
    checkboxes: {
      include_equal_opportunity_clause_yes: {
        page: 0,
        x: 80,
        y: 560,
        size: 9,
        source: 'include_equal_opportunity_clause',
      },
      notify_unions_yes: {
        page: 0,
        x: 80,
        y: 540,
        size: 9,
        source: 'notify_unions',
      },
      advertising_statement_included_yes: {
        page: 0,
        x: 80,
        y: 520,
        size: 9,
        source: 'advertising_statement_included',
      },
      reporting_access_agreed_yes: {
        page: 0,
        x: 80,
        y: 500,
        size: 9,
        source: 'reporting_access_agreed',
      },
      exec_order_compliance_agreed_yes: {
        page: 0,
        x: 80,
        y: 480,
        size: 9,
        source: 'exec_order_compliance_agreed',
      },
      subcontractor_flowdown_agreed_yes: {
        page: 0,
        x: 80,
        y: 460,
        size: 9,
        source: 'subcontractor_flowdown_agreed',
      },
      debarred_contractor_blocked_yes: {
        page: 0,
        x: 80,
        y: 440,
        size: 9,
        source: 'debarred_contractor_blocked',
      },
    },
  },
  form_RD_400_4: {
    base: 'form_RD_400_4.pdf',
    mode: 'absolute',
    required: [
      'recipient_name',
      'recipient_address_street',
      'recipient_address_city',
      'recipient_address_state',
      'recipient_address_zip',
      'recipient_title',
      'date_signed',
    ],
    coords: {
      recipient_name: { page: 0, x: 140, y: 670, fontSize: 11 },
      recipient_address_street: { page: 0, x: 140, y: 652, fontSize: 11 },
      recipient_address_city: { page: 0, x: 140, y: 634, fontSize: 11 },
      recipient_address_state: { page: 0, x: 360, y: 634, fontSize: 11 },
      recipient_address_zip: { page: 0, x: 420, y: 634, fontSize: 11 },
      recipient_title: { page: 0, x: 140, y: 208, fontSize: 11 },
      recipient_signature: { page: 0, x: 140, y: 226, fontSize: 11 },
      date_signed: { page: 0, x: 430, y: 226, fontSize: 11 },
      attest_signature: { page: 0, x: 140, y: 188, fontSize: 11 },
      attest_title: { page: 0, x: 360, y: 188, fontSize: 11 },
    },
  },
  form_RD_400_8: {
    base: 'form_RD_400_8.pdf',
    mode: 'absolute',
    coords: {
      date_of_review: { page: 0, x: 90, y: 720 },
      state: { page: 0, x: 260, y: 720 },
      county: { page: 0, x: 400, y: 720 },
      case_number: { page: 0, x: 90, y: 700 },
      borrower_name: { page: 0, x: 90, y: 680 },
      borrower_address: { page: 0, x: 90, y: 660 },
    },
    checkboxes: {
      source_of_funds_direct: { page: 0, x: 260, y: 700 },
      source_of_funds_insured: { page: 0, x: 310, y: 700 },
      type_of_assistance_housing_preservation_grant: { page: 0, x: 90, y: 640 },
      type_of_assistance_rbeg: { page: 0, x: 90, y: 620 },
      type_of_assistance_rbog: { page: 0, x: 90, y: 600 },
      type_of_assistance_bi_loans: { page: 0, x: 90, y: 580 },
      type_of_assistance_water_and_waste_disposal_loan_or_grant: { page: 0, x: 90, y: 560 },
      type_of_assistance_grazing_association: { page: 0, x: 90, y: 540 },
      type_of_assistance_eo_cooperative: { page: 0, x: 90, y: 520 },
      type_of_assistance_community_facilities: { page: 0, x: 90, y: 500 },
      type_of_assistance_intermediary_relending_program: { page: 0, x: 90, y: 480 },
      type_of_assistance_rural_housing_site_loans: { page: 0, x: 90, y: 460 },
      type_of_assistance_cooperative_service: { page: 0, x: 90, y: 440 },
      type_of_assistance_rrh_and_lh_organization: { page: 0, x: 90, y: 420 },
      type_of_assistance_other: { page: 0, x: 90, y: 400 },
    },
    required: ['date_of_review', 'state', 'county', 'case_number', 'borrower_name'],
  },
  form_6765: {
    base: 'form_6765.pdf',
    mode: 'absolute',
    coords: {
      taxpayer_name: { page: 0, x: 50, y: 700 },
      ein: { page: 0, x: 300, y: 700 },
      total_qre: { page: 0, x: 50, y: 680 },
    },
    required: ['taxpayer_name', 'ein', 'total_qre'],
  },
  form_8974: {
    base: 'form_8974.pdf',
    mode: 'absolute',
    coords: {
      employer_identification_number: { page: 0, x: 50, y: 700 },
      name: { page: 0, x: 300, y: 700 },
      credit_amount: { page: 0, x: 50, y: 680 },
    },
    required: ['employer_identification_number', 'name', 'credit_amount'],
  },
};

module.exports = { getLatestTemplate, getTemplate, cacheTemplate, cache, pdfTemplates };
