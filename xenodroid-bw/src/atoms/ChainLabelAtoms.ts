/**
 * Business Rule: ResolveChainLabel
 *
 * CMS Care Compare publishes a `chain_name` for nursing facilities that is
 * sometimes an organization ("SIGNATURE HEALTHCARE") and sometimes one or
 * more individual owners' names. The person-level gate forbids any
 * individual's name outside the PSA layer, so a chain label is stored only
 * when it carries an unambiguous organization marker. Everything else is
 * withheld — the chain is still tracked by its CMS chain_id, only the label
 * is suppressed. The rule is an allowlist, never a person-name detector.
 */

const ORGANIZATION_MARKERS = [
  'INC', 'INCORPORATED', 'LLC', 'L.L.C', 'LLP', 'LP', 'LTD', 'CORP', 'CORPORATION', 'CO', 'COMPANY',
  'HOLDING', 'HOLDINGS', 'GROUP', 'PARTNERS', 'PARTNERSHIP', 'ASSOCIATES', 'ENTERPRISES', 'MANAGEMENT',
  'HEALTH', 'HEALTHCARE', 'HEALTH CARE', 'CARE', 'SENIOR', 'LIVING', 'NURSING', 'REHAB', 'REHABILITATION',
  'CENTER', 'CENTERS', 'CENTRE', 'HOSPITAL', 'HOSPITALS', 'MEDICAL', 'CLINIC', 'SERVICES', 'SYSTEM', 'SYSTEMS',
  'NETWORK', 'COMMUNITIES', 'COMMUNITY', 'FOUNDATION', 'MINISTRIES', 'MINISTRY', 'SISTERS', 'BROTHERS',
  'DIOCESE', 'CHURCH', 'BAPTIST', 'METHODIST', 'LUTHERAN', 'CATHOLIC', 'PRESBYTERIAN', 'JEWISH', 'HOMES',
  'VILLAGE', 'MANOR', 'ESTATES', 'PROPERTIES', 'REALTY', 'CAPITAL', 'INVESTMENTS', 'OPERATIONS', 'OPCO',
  'UNIVERSITY', 'COUNTY', 'CITY', 'STATE', 'DEPARTMENT', 'AUTHORITY', 'DISTRICT', 'COMMONWEALTH',
  'TRUST', 'FUND', 'ALLIANCE', 'ASSOCIATION', 'COOPERATIVE', 'CONSORTIUM', 'AMERICA', 'AMERICAN', 'NATIONAL',
  'REGIONAL', 'PACS', 'ENSIGN', 'GENESIS', 'SIGNATURE', 'TRILOGY', 'ENCORE', 'LYON', 'PROVIDENCE', 'CONSULATE',
];

const MARKER_PATTERN = new RegExp(`(^|[^A-Z])(${ORGANIZATION_MARKERS.map((m) => m.replace(/[.]/g, '\\.')).join('|')})([^A-Z]|$)`, 'i');

export type ChainLabelResolution = {
  chainId: string | null;
  label: string | null;
  status: 'organization' | 'withheld_not_organization' | 'no_chain';
};

export function ResolveChainLabel(chainId: string | null | undefined, chainName: string | null | undefined): ChainLabelResolution {
  const id = String(chainId || '').trim() || null;
  const name = String(chainName || '').trim();
  if (!id && !name) return { chainId: null, label: null, status: 'no_chain' };
  if (name && MARKER_PATTERN.test(name.toLocaleUpperCase())) {
    return { chainId: id, label: name, status: 'organization' };
  }
  return { chainId: id, label: null, status: 'withheld_not_organization' };
}

/** Display text for a chain whose label was withheld: the CMS chain id only. */
export function ChainDisplayLabel(resolution: { chainId: string | null; label: string | null; status: string }) {
  if (resolution.label) return resolution.label;
  if (resolution.chainId) return `CMS chain ${resolution.chainId} (label withheld: not an organization name)`;
  return 'No CMS chain reported';
}
