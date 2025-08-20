import type { EligibilityItem } from './types';

export function toArray(value: string | string[] | null | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

export function normalizeEligibility(
  arr: Array<Record<string, any>> | null | undefined
): EligibilityItem[] {
  return (arr ?? []).map((item) => ({
    name: item.name ?? item.program ?? '',
    eligible: typeof item.eligible === 'boolean' ? item.eligible : null,
    missing_fields: toArray(item.missing_fields),
    estimated_amount:
      typeof item.estimated_amount === 'number'
        ? item.estimated_amount
        : undefined,
    reasoning: toArray(item.reasoning ?? item.reasoning_steps),
    next_steps: item.next_steps ?? undefined,
    requiredForms: toArray(item.requiredForms),
  }));
}
