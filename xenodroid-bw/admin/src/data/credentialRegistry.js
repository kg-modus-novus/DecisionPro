// Managed-credential metadata only. Never store key values, secrets, or
// credential file contents here — this registry drives expiry alerting in the
// admin workbench and nothing else.
export const MANAGED_CREDENTIALS = [
  {
    id: 'sam-gov-api-key',
    label: 'SAM.gov API key',
    // Valid through this date (from the Director-provisioned key record kept
    // outside the repository). Update on rotation.
    expiresOn: '2026-11-30',
    warnDays: 30,
    usedBy: 'OFR crosswalk (SAM_ENTITY UEI↔EIN seed)',
    rotation:
      'Rotate at SAM.gov, replace the Director-held key file outside the repo, then update expiresOn here.',
    degradation:
      'SAM-dependent loads degrade to the USAspending-seeded fallback with a recorded catalogue gap.',
  },
];
