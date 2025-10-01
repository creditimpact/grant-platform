import { toArray, normalizeEligibility, toEligibilityPercent } from '@/lib/normalize';

describe('normalize toArray', () => {
  it('handles string', () => {
    expect(toArray('a')).toEqual(['a']);
  });
  it('handles array', () => {
    expect(toArray(['a', 'b'])).toEqual(['a', 'b']);
  });
  it('handles null/undefined', () => {
    expect(toArray(undefined)).toEqual([]);
  });
  it('filters empties', () => {
    expect(toArray(['', 'x'])).toEqual(['x']);
  });
});

describe('toEligibilityPercent', () => {
  it('maps eligible to >=80 and <=98', () => {
    const percent = toEligibilityPercent('eligible', 0.83);
    expect(percent).toBeGreaterThanOrEqual(80);
    expect(percent).toBeLessThanOrEqual(98);
  });
  it('maps conditional to 55-78', () => {
    const percent = toEligibilityPercent('conditional', 0.6);
    expect(percent).toBeGreaterThanOrEqual(55);
    expect(percent).toBeLessThanOrEqual(78);
  });
  it('maps ineligible to 50-54', () => {
    const percent = toEligibilityPercent('ineligible', 0.12);
    expect(percent).toBeGreaterThanOrEqual(50);
    expect(percent).toBeLessThanOrEqual(54);
  });
});

describe('normalizeEligibility', () => {
  it('coerces missing_fields', () => {
    const input = [{ program: 'p', eligible: null, missing_fields: 'x' }];
    const out = normalizeEligibility(input);
    expect(out[0].missing_fields).toEqual(['x']);
  });
  it('handles nullish input', () => {
    expect(normalizeEligibility(null)).toEqual([]);
    expect(normalizeEligibility(undefined)).toEqual([]);
  });
  it('preserves and normalizes fields', () => {
    const input = [
      {
        program: 'p',
        eligible: true,
        missing_fields: null,
        estimated_amount: 100,
        reasoning: 'because',
        next_steps: null,
        requiredForms: 'formA',
        required_documents: ['docA'],
      },
    ];
    const out = normalizeEligibility(input);
    expect(out).toEqual([
      {
        name: 'p',
        eligible: true,
        missing_fields: [],
        estimated_amount: 100,
        reasoning: ['because'],
        next_steps: undefined,
        requiredForms: ['formA'],
        requiredDocuments: ['docA'],
      },
    ]);
  });
  it('hides status and rationale for customers', () => {
    const input = [
      {
        name: 'g',
        status: 'eligible',
        rationale: 'great',
        certainty_level: 0.9,
      },
    ];
    const out = normalizeEligibility(input);
    expect(out[0].status).toBeUndefined();
    expect(out[0].rationale).toBeUndefined();
    expect(out[0].eligibility_percent).toBeGreaterThanOrEqual(80);
  });
  it('includes status and rationale for admins', () => {
    const input = [
      {
        name: 'g',
        status: 'conditional',
        rationale: 'missing docs',
        certainty_level: 0.6,
      },
    ];
    const out = normalizeEligibility(input, { admin: true });
    expect(out[0].status).toBe('conditional');
    expect(out[0].rationale).toBe('missing docs');
    expect(out[0].certainty_level).toBeCloseTo(0.6);
    expect(out[0].eligibility_percent).toBeGreaterThanOrEqual(55);
  });
});
