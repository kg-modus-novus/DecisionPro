/**
 * Parses a Medicaid.gov Section 1115 demonstration page
 * (medicaid.gov/medicaid/section-1115-demo/demonstration-and-waiver-list/{id})
 * for its "Waiver Dates" block (Approval/Effective/Expiration) and its
 * "Supporting Documents" table (posted date + title). CMS publishes no
 * structured API for this — the page itself is the source of record, so
 * this parser fails loudly (throws) if the expected landmarks are missing
 * rather than silently returning wrong or empty dates.
 */

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const FILE_TYPE_LINE_RE = /^\((PDF|XLSX|XLSM|DOCX?|CSV)\b/i;
const SKIP_TITLE_LINE_RE = /^(View( Comments)?( for .*)?|Comments link not available|for .*)$/i;

export function StripHtmlToLines(html: string): string[] {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, '\n');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-');
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

function parseMmDdYyyy(value: string): string {
  const [mm, dd, yyyy] = value.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

export type CmsWaiverDates = { approval: string; effective: string; expiration: string };

/** Finds "Approval:" / "Effective:" / "Expiration:" each followed by an MM/DD/YYYY line. Throws if any is missing. */
export function ParseWaiverDates(lines: string[]): CmsWaiverDates {
  const findAfterLabel = (label: string): string => {
    const idx = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
    if (idx < 0) throw new Error(`ParseWaiverDates: "${label}" label not found on page — page structure may have changed`);
    for (let i = idx + 1; i < Math.min(idx + 4, lines.length); i += 1) {
      if (DATE_RE.test(lines[i])) return parseMmDdYyyy(lines[i]);
    }
    throw new Error(`ParseWaiverDates: no MM/DD/YYYY date found after "${label}" label`);
  };
  return {
    approval: findAfterLabel('Approval:'),
    effective: findAfterLabel('Effective:'),
    expiration: findAfterLabel('Expiration:'),
  };
}

export type CmsSupportingDocument = { date: string; title: string };

/**
 * Finds the "Supporting Documents" section and extracts (date, title) pairs.
 * Each entry is a date line, immediately or shortly followed by a title line
 * (skipping file-type/size annotations and "View"/"Comments" noise lines).
 * Returns at most `limit` entries, in the page's own (newest-first) order.
 */
export function ParseSupportingDocuments(lines: string[], limit = 6): CmsSupportingDocument[] {
  const startIdx = lines.findIndex((line) => line.toLowerCase() === 'supporting documents');
  if (startIdx < 0) return [];
  const out: CmsSupportingDocument[] = [];
  for (let i = startIdx + 1; i < lines.length && out.length < limit; i += 1) {
    if (!DATE_RE.test(lines[i])) continue;
    const date = parseMmDdYyyy(lines[i]);
    let title: string | null = null;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j += 1) {
      const candidate = lines[j];
      if (DATE_RE.test(candidate)) break;
      if (FILE_TYPE_LINE_RE.test(candidate) || SKIP_TITLE_LINE_RE.test(candidate) || candidate.toLowerCase() === 'title') continue;
      title = candidate;
      break;
    }
    if (title) out.push({ date, title });
  }
  return out;
}
