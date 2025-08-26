import type { EligibilityItem } from './types';

export function toArray(value: string | string[] | null | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

export function toEligibilityPercent(status: string, certainty: number): number {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  let publicScore = certainty ?? 0;
  switch (status) {
    case 'eligible':
      publicScore = clamp(publicScore, 0.8, 0.98);
      break;
    case 'conditional':
      publicScore = clamp(publicScore, 0.55, 0.78);
      break;
    default:
      publicScore = clamp(publicScore, 0.5, 0.54);
      break;
  }
  return Math.max(Math.round(publicScore * 100), 50);
}

export function normalizeEligibility(
  arr: Array<Record<string, any>> | null | undefined,
  opts: { admin?: boolean } = {}
): EligibilityItem[] {
  return (arr ?? []).map((item) => {
    const status = item.status;
    let certainty = item.certainty_level;
    if (typeof certainty === 'string') {
      const map: Record<string, number> = { high: 0.9, medium: 0.7, low: 0.5 };
      certainty = map[certainty] ?? 0;
    }
    if (typeof certainty !== 'number') certainty = 0;
    const eligibility_percent =
      typeof status === 'string'
        ? toEligibilityPercent(status, certainty)
        : undefined;

    const base: EligibilityItem = {
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
      ...(eligibility_percent !== undefined
        ? { eligibility_percent }
        : {}),
    };

    if (opts.admin) {
      return {
        ...base,
        status,
        rationale: item.rationale ?? undefined,
        certainty_level: certainty,
      };
    }
    return base;
  });
}
