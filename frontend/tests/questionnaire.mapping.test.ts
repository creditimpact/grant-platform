import { apiToUi, snakeToCamel, toIsoDateYMD } from '@/lib/field-map';
import {
  toNumberOrUndefined,
  yesNoToBoolOrUndefined,
} from '@/lib/coerce';

describe('field map utilities', () => {
  it('maps snake_case to UI keys', () => {
    const fields = ['business_type', 'unknown_field'];
    const mapped = fields.map((f) => apiToUi[f] ?? snakeToCamel(f));
    expect(mapped).toMatchInlineSnapshot(`
Array [
  "businessType",
  "unknownField",
]
`);
  });
});

describe('coercion helpers', () => {
  it('toNumberOrUndefined', () => {
    expect(toNumberOrUndefined('')).toBeUndefined();
    expect(toNumberOrUndefined('123')).toBe(123);
    expect(toNumberOrUndefined('abc')).toBeUndefined();
  });

  it('yesNoToBoolOrUndefined', () => {
    expect(yesNoToBoolOrUndefined('yes')).toBe(true);
    expect(yesNoToBoolOrUndefined('no')).toBe(false);
    expect(yesNoToBoolOrUndefined('maybe')).toBeUndefined();
  });
});

describe('date normalization', () => {
  it('toIsoDateYMD', () => {
    expect(toIsoDateYMD('2024-01-02')).toBe('2024-01-02');
    expect(toIsoDateYMD('31/12/2024')).toBe('2024-12-31');
    expect(toIsoDateYMD('02/03/2024')).toBe('2024-02-03');
  });
});
