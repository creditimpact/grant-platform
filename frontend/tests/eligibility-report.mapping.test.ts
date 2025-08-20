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
});
