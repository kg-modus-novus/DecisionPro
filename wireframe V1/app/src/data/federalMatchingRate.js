/**
 * Regular Medicaid federal medical assistance percentage (FMAP) for the federal
 * fiscal year that covers most of the share-and-surge screen's latest year
 * (calendar 2024 sits mostly in FY2024, October 2023 to September 2024).
 *
 * Source: KFF, "Federal Medical Assistance Percentage (FMAP) for Medicaid and
 * Multiplier" (state indicator), which reproduces the Federal Register FMAP
 * notices; read 2026-11-07. Regular FMAP only: the expansion-group and CHIP
 * enhanced rates are higher, so the state share shown is an upper bound for
 * services paid for the expansion population.
 *
 * Used by the leveling what-if to say how much of a redirected Medicaid dollar
 * is state money if it leaves Medicaid (1 - FMAP) and that a dollar redirected
 * to another covered service draws the federal match again.
 */
/** The state's share of a regular Medicaid dollar: what stays state money if the dollar leaves Medicaid. */
export const stateShareOfMedicaidDollar = (state) => 1 - FEDERAL_MATCHING_RATE[state].fmap;

export const FEDERAL_MATCHING_RATE = {
  KY: { fiscalYear: 'FY2024', fmap: 0.7178, source: 'KFF FMAP state indicator (Federal Register notice), read 2026-11-07' },
  FL: { fiscalYear: 'FY2024', fmap: 0.5796, source: 'KFF FMAP state indicator (Federal Register notice), read 2026-11-07' },
};
