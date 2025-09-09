const { extractBankStatement } = require('../services/extractors/bankStatement');

describe('extractBankStatement', () => {
  const sample = `Statement Period: Jan 1, 2024 through Jan 31, 2024\nAccount Number: ****5678\nBeginning Balance $1,000.00\nClosing Balance $1,500.00\nTotal Deposits $600.00\nTotal Withdrawals $100.00`;
  test('parses core fields', () => {
    const res = extractBankStatement({ text: sample, vendor: 'US Bank', confidence: 0.9 });
    expect(res.account_number_last4).toBe('5678');
    expect(res.statement_period.start).toBe('2024-01-01');
    expect(res.statement_period.end).toBe('2024-01-31');
    expect(res.beginning_balance).toBe(1000);
    expect(res.ending_balance).toBe(1500);
    expect(res.totals.deposits).toBe(600);
    expect(res.totals.withdrawals).toBe(100);
    expect(res.warnings).toHaveLength(0);
  });
});
