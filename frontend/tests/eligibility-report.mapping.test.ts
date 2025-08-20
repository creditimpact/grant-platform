import { toArray, normalizeEligibility } from '@/lib/normalize';

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
      },
    ]);
  });
});
