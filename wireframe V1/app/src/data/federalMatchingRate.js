/**
 * Regular Medicaid federal medical assistance percentage (FMAP), federal fiscal
 * year 2024 (October 2023 to September 2024, which covers most of calendar 2024,
 * the latest year in the T-MSIS spending file), for the 50 states and DC.
 *
 * Source: KFF, "Federal Medical Assistance Percentage (FMAP) for Medicaid and
 * Multiplier" state indicator, FY 2024 table, read 2026-11-07. KFF cites the
 * Federal Register notice of 2022-12-05 (Vol. 87, No. 232, pp. 74429-74432).
 * Regular FMAP only: the expansion-group rate (90%) and CHIP enhanced rates are
 * higher, so the state share shown is an upper bound for expansion spending.
 *
 * Used by the reallocation what-if to split a freed Medicaid dollar into the
 * federal and state shares.
 */
export const FMAP_SOURCE = 'KFF FMAP state indicator, FY 2024 (Federal Register 2022-12-05), read 2026-11-07';

export const FEDERAL_MATCHING_RATE_FY2024 = Object.freeze({
  AL: 0.7312, AK: 0.5001, AZ: 0.6629, AR: 0.7200, CA: 0.5000, CO: 0.5000, CT: 0.5000, DE: 0.5971, DC: 0.7000,
  FL: 0.5796, GA: 0.6589, HI: 0.5856, ID: 0.6972, IL: 0.5109, IN: 0.6562, IA: 0.6413, KS: 0.6097, KY: 0.7178,
  LA: 0.6767, ME: 0.6265, MD: 0.5000, MA: 0.5000, MI: 0.6494, MN: 0.5149, MS: 0.7727, MO: 0.6607, MT: 0.6391,
  NE: 0.5860, NV: 0.6077, NH: 0.5000, NJ: 0.5000, NM: 0.7259, NY: 0.5000, NC: 0.6591, ND: 0.5382, OH: 0.6430,
  OK: 0.6753, OR: 0.5931, PA: 0.5412, RI: 0.5501, SC: 0.6953, SD: 0.5498, TN: 0.6528, TX: 0.6015, UT: 0.6590,
  VT: 0.5675, VA: 0.5122, WA: 0.5000, WV: 0.7410, WI: 0.6066, WY: 0.5000,
});
