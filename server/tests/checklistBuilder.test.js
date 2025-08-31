const { buildChecklist } = require('../utils/checklistBuilder');

describe('buildChecklist', () => {
  const grantsLibrary = {
    erc: {
      required_docs: ['IRS_941X'],
      common_docs: ['W9_Form'],
    },
    business_tax_refund: {
      required_docs: ['IRS_941X', 'Tax_Payment_Receipt'],
      common_docs: ['W9_Form', 'FEIN'],
    },
  };

  test('returns empty array when no grants', async () => {
    const { required } = await buildChecklist({
      shortlistedGrants: [],
      grantsLibrary,
    });
    expect(required).toEqual([]);
  });

  test('deduplicates docs and hydrates status', async () => {
    const caseDocs = [{ doc_type: 'IRS_941X', status: 'uploaded' }];
    const { required } = await buildChecklist({
      shortlistedGrants: ['erc', 'business_tax_refund'],
      grantsLibrary,
      caseDocuments: caseDocs,
    });

    const order = required.map((d) => d.doc_type);
    expect(order).toEqual(['FEIN', 'W9_Form', 'IRS_941X', 'Tax_Payment_Receipt']);

    const irs = required.find((d) => d.doc_type === 'IRS_941X');
    expect(irs.source).toBe('grant');
    expect(irs.grants.sort()).toEqual(['business_tax_refund', 'erc']);
    expect(irs.status).toBe('uploaded');

    const w9 = required.find((d) => d.doc_type === 'W9_Form');
    expect(w9.source).toBe('common');
    expect(w9.grants).toEqual([]);
    expect(w9.status).toBe('not_uploaded');
  });
});

