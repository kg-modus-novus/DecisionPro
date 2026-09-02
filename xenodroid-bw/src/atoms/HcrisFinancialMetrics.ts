/**
 * CMS HCRIS total margin (Medicare cost-report basis).
 * Worksheet G-3: Net Income / (Net Patient Revenue + Total Other Income).
 * A missing component or zero denominator is not imputed.
 */
export function HcrisTotalMargin(
  netIncome: number | null,
  netPatientRevenue: number | null,
  totalOtherIncome: number | null,
): number | null {
  if (netIncome == null || netPatientRevenue == null || totalOtherIncome == null) return null;
  const totalRevenue = netPatientRevenue + totalOtherIncome;
  return totalRevenue === 0 ? null : netIncome / totalRevenue;
}
