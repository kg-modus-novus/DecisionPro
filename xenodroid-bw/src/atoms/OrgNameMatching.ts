const NAME_SUFFIXES = /\b(INC|INCORPORATED|LLC|LLP|LP|CORP|CORPORATION|CO|COMPANY|THE|LTD)\b/g;

export function NormalizeOrgName(name: string): string {
  return String(name || '')
    .toUpperCase()
    .replace(/[.,'"&]/g, ' ')
    .replace(NAME_SUFFIXES, ' ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function NormalizeAddressLine(line: string): string {
  return String(line || '')
    .toUpperCase()
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bSUITE\b/g, 'STE')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First significant token, used as a coarse match-blocking key so pairwise
 * comparison never runs against the full cross product of large source
 * tables (e.g. 113k IRS EO BMF rows). */
export function BlockingKey(normalizedName: string): string {
  const token = normalizedName.split(' ').find((word) => word.length >= 3);
  return token ? token.slice(0, 6) : normalizedName.slice(0, 6);
}

/** Jaccard token-set similarity, 0..1. */
export function TokenSetSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(' ').filter(Boolean));
  const setB = new Set(b.split(' ').filter(Boolean));
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}
