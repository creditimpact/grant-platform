const { detectDocType } = require('../services/docType');

describe('detectDocType', () => {
  test('detects bank statement text', () => {
    const text = `Statement Period: Jan 1, 2024 through Jan 31, 2024\nAccount Number: XXXX1234\nBeginning Balance $100.00\nEnding Balance $150.00\nDeposits\nWithdrawals`;
    const res = detectDocType(text);
    expect(res.type).toBe('bank_statement');
    expect(res.confidence).toBeGreaterThanOrEqual(0.8);
  });

  test('non bank document', () => {
    const text = 'Invoice #123 for services rendered.';
    const res = detectDocType(text);
    expect(res.type).not.toBe('bank_statement');
    expect(res.confidence).toBeLessThan(0.5);
  });
});
