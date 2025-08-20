export const toNumberOrUndefined = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const yesNoToBoolOrUndefined = (v: unknown): boolean | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const s = String(v).toLowerCase();
  if (s === 'yes' || s === 'true') return true;
  if (s === 'no' || s === 'false') return false;
  return undefined;
};

export const keepStringOrEmpty = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v);
