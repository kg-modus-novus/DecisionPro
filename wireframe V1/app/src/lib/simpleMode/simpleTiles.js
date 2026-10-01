// CodeXen: v1 not-applicable
// The simple-mode tile catalog: every tile a legislator can put on the opening
// dashboard. A tile shows one sourced measure and opens the page that explains
// it. DEFAULT_TILE_IDS is the standard dashboard every visitor starts with.
import { formatNumber } from './measureModel.js';
import { maybeMeasure } from './sourcedData.js';

function shareOfCounties(m) {
  const total = m.comparison?.value || 120;
  return {
    visual: 'radial',
    value: `${m.value} of ${total}`,
    radial: { percent: (m.value / total) * 100, caption: 'Kentucky counties' },
  };
}

export const TILE_CATALOG = [
  // Standard dashboard, in the order of the framework's priorities.
  { id: 'access', title: 'Access to care', measureId: 'hpsa-primary-care-counties', label: 'Counties short of primary care doctors', view: 'simple-access', visual: shareOfCounties },
  { id: 'appointments', title: 'Getting an appointment', measureId: 'bh-appt-routine-within-30-days', view: 'simple-access' },
  { id: 'spending', title: 'Spending', measureId: 'total-medicaid-spending', view: 'simple-spending' },
  { id: 'cost-per-member', title: 'Cost drivers', measureId: 'benefit-spending-pmpm', view: 'simple-spending' },
  { id: 'mco', title: 'MCO accountability', measureId: 'pa-standard-denied-pct', view: 'simple-plans' },
  { id: 'outcomes', title: 'Required health outcomes', measureId: 'cs-fua-adult-7day', view: 'simple-outcomes' },
  { id: 'waivers', title: 'Waiver waitlist', measureId: 'waiver-waitlist-unduplicated', view: 'simple-waivers' },
  { id: 'ltc', title: 'Long-term care', measureId: 'nursing-facility-ffs-spending', view: 'simple-ltc' },
  { id: 'bh', title: 'Behavioral health', measureId: 'bh-spend-mco', view: 'simple-bh' },
  { id: 'hospital', title: 'Hospital and ER use', measureId: 'ed-visits-per-1000', view: 'simple-access', anchor: 'hospital' },
  { id: 'pharmacy', title: 'Pharmacy', measureId: 'rx-gross-reimbursed', view: 'simple-spending', anchor: 'pharmacy' },
  { id: 'admin', title: 'Cost of running Medicaid', measureId: 'admin-spending-cms64', view: 'simple-spending', anchor: 'admin' },
  { id: 'renewals', title: 'Department performance', measureId: 'renewals-retained-rate', view: 'simple-coverage', anchor: 'renewals', wide: true },

  // More tiles to add from the catalog.
  { id: 'members', title: 'Members', measureId: 'members-total-dms', view: 'simple-coverage' },
  { id: 'children', title: 'Children covered', measureId: 'children-kchip-vs-medicaid', view: 'simple-coverage' },
  { id: 'expansion', title: 'Expansion adults', measureId: 'expansion-adults', view: 'simple-coverage' },
  { id: 'fmap', title: 'Federal match', measureId: 'fmap', view: 'simple-spending' },
  { id: 'nf-share', title: 'Nursing homes’ share of spending', measureId: 'nursing-facility-ffs-share', view: 'simple-ltc' },
  { id: 'nf-rate', title: 'Nursing home payment', measureId: 'nf-medicaid-rate-vs-cost', view: 'simple-ltc', anchor: 'nf-payment' },
  { id: 'nf-hospital', title: 'Nursing home residents sent to hospital', measureId: 'nf-hosp-per-1000', view: 'simple-ltc', anchor: 'nf-outcomes' },
  { id: 'nf-meds', title: 'Nursing home sedatives', measureId: 'nf-antianxiety', view: 'simple-ltc', anchor: 'nf-outcomes' },
  { id: 'waiver-delivery', title: 'Waiver slots not yet started', measureId: 'hcbs-allocated-not-started', view: 'simple-waivers', anchor: 'delivery' },
  { id: 'well-care', title: 'Child well-care (KRS 7A.287)', measureId: 'cs-wcv-child-adolescent-well-care', view: 'simple-outcomes', anchor: 'krs-c' },
  { id: 'postpartum', title: 'Postpartum care (KRS 7A.287)', measureId: 'cs-ppc-postpartum-adult', view: 'simple-outcomes', anchor: 'krs-d' },
  { id: 'blood-pressure', title: 'Blood pressure (KRS 7A.287)', measureId: 'cs-cbp-blood-pressure-control', view: 'simple-outcomes', anchor: 'krs-f' },
  { id: 'cervical', title: 'Cancer screening (KRS 7A.287)', measureId: 'cs-ccs-cervical-screening', view: 'simple-outcomes', anchor: 'krs-b' },
  { id: 'withhold', title: 'Quality money at stake', measureId: 'quality-withhold-dollars-estimate', view: 'simple-plans', anchor: 'money-at-stake' },
  { id: 'directed', title: 'Directed payments', measureId: 'directed-payments', view: 'simple-spending', anchor: 'what-it-buys' },
  { id: 'moud', title: 'Addiction medication', measureId: 'members-on-moud', view: 'simple-bh', anchor: 'addiction' },
  { id: '988', title: '988 crisis line', measureId: '988-in-state-answer-rate', view: 'simple-bh', anchor: 'crisis' },
  { id: 'processing', title: 'Application speed', measureId: 'pi-determination-timeliness', view: 'simple-coverage', anchor: 'applications' },
  { id: 'staff', title: 'Medicaid department staff', measureId: 'dms-staff-fte-estimate', view: 'simple-spending', anchor: 'admin' },
  { id: 'rx-net', title: 'Drugs after rebates', measureId: 'rx-net-spend-est', view: 'simple-spending', anchor: 'pharmacy' },
  { id: 'travel', title: 'Travel to addiction treatment', measureId: 'drive-time-otp-county-est', view: 'simple-access', anchor: 'travel' },
].filter((t) => maybeMeasure(t.measureId));

export const DEFAULT_TILE_IDS = TILE_CATALOG.slice(0, 13).map((t) => t.id);

/** Local reading of a county-level tile when a county is selected. */
export function localTileReading(measure, geo) {
  if (geo?.kind !== 'county' || measure?.dimension !== 'county') return null;
  const row = measure.rows.find((r) => r.fips === geo.key);
  if (!row) return null;
  const value = measure.unit === 'hours' ? `${Math.round(row.value * 60)} min` : formatNumber(row.value, measure.unit);
  return `${row.label.replace(/\s*\(.*\)$/, '').split(':')[0]} County: ${value}`;
}
