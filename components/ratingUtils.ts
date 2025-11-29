// Utility to safely normalize rating values that may arrive as number|string|null|undefined
// Falls back to 0 when not a finite number. Returns a number.
export function getNumericRating(raw: any): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatRating(raw: any, digits: number = 2): string {
  return getNumericRating(raw).toFixed(digits);
}
