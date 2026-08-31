const DAY_MS = 24 * 60 * 60 * 1000;

function parseLocalDate(isoDate) {
  const [year, month, day] = String(isoDate)
    .split('-')
    .map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

// A credential is valid through the end of its expiresOn date. daysRemaining
// counts calendar days from today's date to the expiry date, independent of
// time of day: 0 means it expires at the end of today; negative means expired.
export function evaluateCredentialAlerts(credentials, now = new Date()) {
  const alerts = [];
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const cred of credentials || []) {
    const expiry = parseLocalDate(cred.expiresOn);
    if (!expiry) continue;
    // Math.round absorbs DST hour shifts inside the day count.
    const daysRemaining = Math.round((expiry.getTime() - startOfToday.getTime()) / DAY_MS);
    const warnDays = Number.isFinite(cred.warnDays) ? cred.warnDays : 30;
    if (daysRemaining > warnDays) continue;

    const expired = daysRemaining < 0;
    const message = expired
      ? `${cred.label} expired on ${cred.expiresOn}. ${cred.degradation || ''}`.trim()
      : daysRemaining === 0
        ? `${cred.label} expires today (${cred.expiresOn}).`
        : `${cred.label} expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (${cred.expiresOn}).`;

    alerts.push({
      id: cred.id,
      label: cred.label,
      status: expired ? 'expired' : 'expiring',
      daysRemaining,
      expiresOn: cred.expiresOn,
      message,
      rotation: cred.rotation || null,
      usedBy: cred.usedBy || null,
    });
  }
  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
