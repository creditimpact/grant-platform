export function toArray(value: string | string[] | null | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

export function normalizeEligibility<T extends { missing_fields?: string | string[] }>(
  arr: T[]
): (Omit<T, 'missing_fields'> & { missing_fields: string[] })[] {
  return (arr ?? []).map((item) => ({
    ...item,
    missing_fields: toArray(item.missing_fields),
  }));
}
