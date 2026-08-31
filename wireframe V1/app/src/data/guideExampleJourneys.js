/**
 * Controlled Show Me journeys launched from regular Guide example bubbles.
 * One journey per role-tour step (7 × 19 = 133). Synthetic fixtures only.
 */

import { ROOM_CONFIGS } from './alp/roomConfigs.js';
import { LAW_INSTRUMENTS } from './alp/legislation.js';
import {
  ATTENTION,
  CONTRACT_CLASSES,
  FRESHNESS,
  MCOS,
  MEASURE_TYPES,
  POPULATIONS,
  REGIONS,
  SERVICE_CATEGORIES,
} from './alp/dimensions.js';
import { EVIDENCE_ROOMS, FINDINGS, FOCUS_TABS, OPTION_PACKS } from './fixtures.js';
import { ROLE_IDS, ROLE_PROFILES, getRoleProfile } from './roleProfiles.js';
import { resolveRoleTourSteps } from './walkthroughs.js';
import { listSlice } from '../lib/alpCube.js';
import { resolveLeadRow } from './showMeJourneys.js';

const DIM_IDS = {
  population: new Set(POPULATIONS.map((d) => d.id)),
  region: new Set(REGIONS.map((d) => d.id)),
  mco: new Set(MCOS.map((d) => d.id)),
  service: new Set(SERVICE_CATEGORIES.map((d) => d.id)),
  attention: new Set(ATTENTION.map((d) => d.id)),
  freshness: new Set(FRESHNESS.map((d) => d.id)),
  measureType: new Set(MEASURE_TYPES.map((d) => d.id)),
  contractClass: new Set(CONTRACT_CLASSES.map((d) => d.id)),
};

const DIM_LABELS = Object.fromEntries(
  [
    ...ATTENTION,
    ...CONTRACT_CLASSES,
    ...FRESHNESS,
    ...MCOS,
    ...MEASURE_TYPES,
    ...POPULATIONS,
    ...REGIONS,
    ...SERVICE_CATEGORIES,
  ].map((item) => [item.id, item.label]),
);

/** Exact room demos aligned with guide example copy. */
export const ROOM_DEMO_SPECS = {
  'command-center': {
    filters: { attention: 'intervene' },
    preferredLeadTitle: 'MCO quality target miss (Eastern KY)',
    filterNarrative:
      'Set Attention to Intervention indicated so the list matches the example question.',
  },
  'cost-drivers': {
    filters: { service: 'pharmacy', population: 'disabled' },
    preferredLeadTitle: 'Pharmacy — Disabled',
    filterNarrative:
      'Set Service to Pharmacy and Population to Disabled to isolate the contribution row named in the example.',
  },
  utilization: {
    filters: { population: 'disabled', region: 'east' },
    preferredLeadTitle: 'Avg miles to care (Eastern KY)',
    filterNarrative:
      'Set Population to Disabled and Region to Eastern KY to surface the travel-distance aggregate.',
  },
  outcomes: {
    filters: { population: 'pregnant', measureType: 'outcome' },
    preferredLeadTitle: 'Postpartum follow-up',
    filterNarrative:
      'Set Population to Pregnant / postpartum and Measure type to Outcome to match the maternal-care example.',
  },
  mco: {
    filters: { mco: 'mco-d', contractClass: 'contracted' },
    preferredLeadTitle: 'WellCare of Kentucky — Quality withholding',
    filterNarrative:
      'Set MCO to WellCare of Kentucky and Contract class to Existing contractual to open the withholding row.',
  },
  provider: {
    filters: {},
    preferredLeadTitle: 'Appalachian Care Network — Disabled',
    filterNarrative:
      'Keep the provider list open so “Appalachian Care Network — Disabled” can be selected for the adjustment comparison.',
  },
  county: {
    filters: { region: 'east', population: 'disabled' },
    preferredLeadTitle: 'Pike (HD-92)',
    filterNarrative:
      'Set Region to Eastern KY and Population to Disabled to reach the Pike (HD-92) district aggregate.',
  },
  benchmarks: {
    filters: { population: 'disabled', freshness: 'lagged' },
    preferredLeadTitle: 'Avoidable ED',
    filterNarrative:
      'Set Population to Disabled and Freshness to Lagged to open the Avoidable ED peer comparison.',
  },
  'measure-definitions': {
    filters: { freshness: 'lagged', measureType: 'cost' },
    preferredLeadTitle: 'PMPM',
    filterNarrative:
      'Set Freshness to Lagged and Measure type to Cost to open the PMPM definition named in the example.',
  },
};

const ROLE_PACK_IDS = {
  legislator: 'pack-district-brief',
  'legislative-staff': 'pack-pc-pharmacy-rural',
  'budget-analyst': 'pack-pc-pharmacy-rural',
  'medicaid-leadership': 'pack-mco-bh',
  'policy-analyst': 'pack-mco-bh',
  'oversight-auditor': 'pack-mco-bh',
  'data-steward': 'pack-pc-pharmacy-rural',
};

const ROLE_LAW_IDS = {
  legislator: 'bill-rural-access',
  'legislative-staff': 'bill-maternal-a',
  'budget-analyst': 'bill-pharmacy-steward',
  'medicaid-leadership': 'gap-network-remedy',
  'policy-analyst': 'bill-rural-access',
  'oversight-auditor': 'gap-data-freshness',
  'data-steward': 'gap-data-freshness',
};

const INDEX_ROOM_BY_ROLE = {
  legislator: 'measure-definitions',
  'legislative-staff': 'provider',
  'budget-analyst': 'county',
  'medicaid-leadership': 'benchmarks',
  'policy-analyst': 'mco',
  'oversight-auditor': 'provider',
  'data-steward': 'provider',
};

function formatFilterExample(filters, roomId) {
  return Object.entries(filters || {})
    .flatMap(([key, value]) => {
      const values = Array.isArray(value) ? value : [value];
      const filterLabel =
        ROOM_CONFIGS[roomId]?.filters?.find((filter) => filter.key === key)?.label || key;
      return values.map((id) => `${filterLabel} to ${DIM_LABELS[id] || id}`);
    })
    .join(' and ');
}

function formatList(items) {
  if (items.length < 2) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function lawDisplayTitle(lawId) {
  const law = LAW_INSTRUMENTS.find((item) => item.id === lawId);
  if (!law) return 'the demonstrated instrument';
  return law.kind === 'pending' ? `${law.title} (${law.cite})` : law.title;
}

function packTitle(packId) {
  return OPTION_PACKS.find((item) => item.id === packId)?.title || 'the demonstrated pack';
}

function roleFocusLabels(roleId) {
  const profile = getRoleProfile(roleId);
  return (profile?.initialState?.selectedFocuses || [])
    .map((id) => FOCUS_TABS.find((focus) => focus.id === id)?.label)
    .filter(Boolean);
}

function roleFindingTitles(roleId) {
  const profile = getRoleProfile(roleId);
  return (profile?.initialState?.selectedFocuses || [])
    .map((focusId) => FINDINGS.find((finding) => finding.focusId === focusId)?.title)
    .filter(Boolean);
}

function roleFindingIds(roleId) {
  const profile = getRoleProfile(roleId);
  return (profile?.initialState?.selectedFocuses || [])
    .map((focusId) => FINDINGS.find((finding) => finding.focusId === focusId)?.id)
    .filter(Boolean);
}

function roleWeights(roleId) {
  const profile = getRoleProfile(roleId);
  return { ...(profile?.initialState?.weights || {}) };
}

function choiceStep({ target, apply, tryStartApply }) {
  return {
    id: 'example-choice',
    title: 'Try it or return',
    narrative:
      'Would you like to try this example yourself now, or return to the previous guided walk-through?',
    target,
    apply,
    choice: true,
    tryStartApply,
  };
}

function baseApply(patch = {}) {
  return {
    evidenceObjectId: null,
    activeLawId: null,
    activePackId: null,
    guidedFilters: {},
    viewMode: 'hybrid',
    objectFacet: null,
    highlightPriorityId: null,
    askSamOpen: false,
    guidedAskSamPrompt: null,
    guidedAskSamReply: null,
    ...patch,
  };
}

function evidenceInvestigationSteps({
  roleId,
  roomId,
  openTarget,
  openNarrative,
  includeNav = false,
}) {
  const demo = ROOM_DEMO_SPECS[roomId];
  const room = EVIDENCE_ROOMS.find((item) => item.id === roomId);
  const filterExample = formatFilterExample(demo.filters, roomId);
  const profile = getRoleProfile(roleId);
  const leadPreview = resolveLeadRow(roomId, demo.filters, demo.preferredLeadTitle);
  const leadTitle = leadPreview?.title || demo.preferredLeadTitle;
  const steps = [];

  if (includeNav) {
    steps.push({
      id: 'nav-room',
      title: `Open ${room?.title || roomId}`,
      narrative: openNarrative,
      target: openTarget,
      apply: baseApply({
        view: 'evidence',
        activeEvidenceId: null,
      }),
    });
  }

  steps.push(
    {
      id: 'open-room',
      title: room?.title || roomId,
      narrative: includeNav
        ? `Now you are in ${room?.title}. The title bar confirms the evidence room for this example.`
        : openNarrative,
      target: 'alp-titlebar',
      apply: baseApply({
        view: 'evidence',
        activeEvidenceId: roomId,
      }),
    },
    {
      id: 'apply-filters',
      title: 'Apply the example filters',
      narrative: demo.filterNarrative
        + (filterExample ? ` Use ${filterExample}.` : ''),
      target: 'alp-visual-filters',
      apply: baseApply({
        view: 'evidence',
        activeEvidenceId: roomId,
        guidedFilters: { ...demo.filters },
      }),
    },
    {
      id: 'read-chart',
      title: 'Read the filtered chart',
      narrative:
        `With those filters applied, compare the chart categories so ${profile.shortLabel} can see which aggregate deserves the next click.`,
      target: 'alp-content-chart',
      apply: baseApply({
        view: 'evidence',
        activeEvidenceId: roomId,
        guidedFilters: { ...demo.filters },
      }),
    },
    {
      id: 'scan-list',
      title: 'Find the named row',
      narrative:
        `Scan the item list for “${leadTitle}” — the exact object named in this example.`,
      target: 'alp-detail-list',
      resolveLead: true,
      preferredLeadTitle: demo.preferredLeadTitle,
      apply: baseApply({
        view: 'evidence',
        activeEvidenceId: roomId,
        guidedFilters: { ...demo.filters },
      }),
    },
    {
      id: 'open-lead',
      title: 'Open the aggregate',
      narrative:
        `Open “${leadTitle}” and carry its displayed magnitude, source, and limitation into the object review.`,
      target: 'alp-lead-item',
      resolveLead: true,
      preferredLeadTitle: demo.preferredLeadTitle,
      apply: baseApply({
        view: 'evidence',
        activeEvidenceId: roomId,
        guidedFilters: { ...demo.filters },
      }),
    },
    {
      id: 'facet-identification',
      title: 'Check Identification',
      narrative:
        `Open Identification on “${leadTitle}” and record owner, period, source, freshness, and limitation before using the figure.`,
      target: 'object-facet-identification',
      resolveLead: true,
      preferredLeadTitle: demo.preferredLeadTitle,
      apply: baseApply({
        view: 'evidence',
        activeEvidenceId: roomId,
        evidenceObjectId: '__lead__',
        guidedFilters: { ...demo.filters },
        objectFacet: 'identification',
      }),
    },
  );

  return steps;
}

function journeyShell({ id, roleId, guideStepId, pattern, title, steps, tryStartApply }) {
  const lastDemo = steps[steps.length - 1];
  const choice = choiceStep({
    target: lastDemo.target,
    apply: lastDemo.apply,
    tryStartApply,
  });
  return {
    id,
    roleId,
    guideStepId,
    pattern,
    title,
    preferredLeadTitle: steps.find((step) => step.preferredLeadTitle)?.preferredLeadTitle || null,
    tryStartApply,
    steps: [...steps, choice],
  };
}

function homePrioritiesJourney(roleId, guideStep) {
  const profile = getRoleProfile(roleId);
  const first = profile.homePriorities[0];
  const steps = [
    {
      id: 'see-priorities',
      title: 'Priorities for this perspective',
      narrative:
        `${profile.shortLabel} starts here. The first priority tile — “${first.title}” — matches the example request.`,
      target: 'role-home-priorities',
      apply: baseApply({ view: 'role-home' }),
    },
    {
      id: 'select-priority',
      title: first.title,
      narrative:
        `Highlight “${first.title}.” ${first.detail}`,
      target: `role-home-priority-${first.id}`,
      apply: baseApply({
        view: 'role-home',
        highlightPriorityId: first.id,
      }),
    },
  ];

  if (first.showMeJourneyId?.includes('blender') || first.id.includes('blend') || first.id.includes('brief-session') || first.id.includes('exportable') || first.id.includes('law-blender') || first.id.includes('law-linkage')) {
    // Priority points at blender/legislation — keep home focus only for triage step.
  } else {
    const roomId =
      profile.primaryActions.find((action) => action.view === 'evidence')?.evidenceId
      || profile.recommendedRooms[0];
    const demo = ROOM_DEMO_SPECS[roomId];
    if (demo) {
      steps.push(...evidenceInvestigationSteps({
        roleId,
        roomId,
        openTarget: `nav-room-${roomId}`,
        openNarrative:
          `From that priority, open ${ROOM_CONFIGS[roomId]?.title || roomId} and recreate the filtered path.`,
        includeNav: true,
      }));
    }
  }

  return journeyShell({
    id: `guide-example:${roleId}:${guideStep.id}`,
    roleId,
    guideStepId: guideStep.id,
    pattern: 'role-home-priority',
    title: `${profile.shortLabel} priority triage`,
    steps,
    tryStartApply: baseApply({
      view: 'role-home',
      highlightPriorityId: first.id,
    }),
  });
}

function homeRoomsJourney(roleId, guideStep) {
  const profile = getRoleProfile(roleId);
  const rooms = profile.recommendedRooms || [];
  const steps = [
    {
      id: 'see-recommended',
      title: 'Recommended Evidence Rooms',
      narrative:
        `${profile.shortLabel} chooses among the recommended rooms shown here. Each room answers a different question from the example.`,
      target: 'role-home-rooms',
      apply: baseApply({ view: 'role-home' }),
    },
  ];

  for (const roomId of rooms) {
    const room = EVIDENCE_ROOMS.find((item) => item.id === roomId);
    const demo = ROOM_DEMO_SPECS[roomId];
    steps.push({
      id: `pick-room-${roomId}`,
      title: room?.title || roomId,
      narrative:
        `Choose “${room?.title}” for the matching question in the example bubble.`,
      target: `role-home-room-${roomId}`,
      apply: baseApply({ view: 'role-home' }),
    });
    if (demo) {
      steps.push(...evidenceInvestigationSteps({
        roleId,
        roomId,
        openTarget: `role-home-room-${roomId}`,
        openNarrative:
          `Opening ${room?.title} starts the filtered path for that question.`,
        includeNav: false,
      }));
      // Return home between multi-room walks so the next room button is visible again.
      if (roomId !== rooms[rooms.length - 1]) {
        steps.push({
          id: `return-home-${roomId}`,
          title: 'Back to recommended rooms',
          narrative:
            'Return to Recommended Evidence Rooms to walk the next question in the example.',
          target: 'role-home-rooms',
          apply: baseApply({ view: 'role-home' }),
        });
      }
    }
  }

  return journeyShell({
    id: `guide-example:${roleId}:${guideStep.id}`,
    roleId,
    guideStepId: guideStep.id,
    pattern: 'role-home-rooms',
    title: `${profile.shortLabel} room routing`,
    steps,
    tryStartApply: baseApply({ view: 'role-home' }),
  });
}

function homeActionsJourney(roleId, guideStep) {
  const profile = getRoleProfile(roleId);
  const action = profile.primaryActions[0];
  const steps = [
    {
      id: 'see-actions',
      title: 'Primary actions',
      narrative:
        `${profile.shortLabel} uses these shortcuts to begin the example task in under five minutes.`,
      target: 'role-home-actions',
      apply: baseApply({ view: 'role-home' }),
    },
    {
      id: 'press-action',
      title: action.label,
      narrative:
        `Press “${action.label}” — the first shortcut named in the example.`,
      target: `role-home-action-${action.id}`,
      apply: baseApply({ view: 'role-home' }),
    },
  ];

  let tryStartApply = baseApply({ view: 'role-home' });

  if (action.view === 'evidence' && action.evidenceId) {
    steps.push(...evidenceInvestigationSteps({
      roleId,
      roomId: action.evidenceId,
      openTarget: `role-home-action-${action.id}`,
      openNarrative:
        `That shortcut opens ${ROOM_CONFIGS[action.evidenceId]?.title}. Continue with the example filters and named row.`,
      includeNav: false,
    }));
    tryStartApply = baseApply({
      view: 'evidence',
      activeEvidenceId: action.evidenceId,
      guidedFilters: { ...(ROOM_DEMO_SPECS[action.evidenceId]?.filters || {}) },
    });
  } else if (action.view === 'blender') {
    const focuses = profile.initialState.selectedFocuses;
    const findingIds = roleFindingIds(roleId);
    const weights = roleWeights(roleId);
    const packId = ROLE_PACK_IDS[roleId];
    steps.push(
      {
        id: 'open-blender',
        title: 'Consideration Blender',
        narrative:
          `The shortcut opens the Consideration Blender with ${formatList(roleFocusLabels(roleId))} ready.`,
        target: 'blender-title',
        apply: baseApply({
          view: 'blender',
          selectedFocuses: focuses,
          blendedIds: [],
          spineStep: 'Results',
        }),
      },
      {
        id: 'blend-findings',
        title: 'Add the example findings',
        narrative:
          `Add ${formatList(roleFindingTitles(roleId))} so packs unlock for comparison.`,
        target: 'blender-findings',
        apply: baseApply({
          view: 'blender',
          selectedFocuses: focuses,
          blendedIds: findingIds,
          weights,
          spineStep: 'Results',
        }),
      },
      {
        id: 'review-packs',
        title: 'Compare option packs',
        narrative:
          `In Action, open “${packTitle(packId)}” as the examination candidate named for this role.`,
        target: 'blender-packs',
        apply: baseApply({
          view: 'blender',
          selectedFocuses: focuses,
          blendedIds: findingIds,
          weights,
          spineStep: 'Action',
          trustReviewed: true,
          activePackId: packId,
        }),
      },
    );
    tryStartApply = baseApply({
      view: 'blender',
      selectedFocuses: focuses,
      blendedIds: [],
      spineStep: 'Results',
    });
  } else if (action.view === 'legislation') {
    const lawId = ROLE_LAW_IDS[roleId];
    const focuses = profile.initialState.selectedFocuses;
    const findingIds = roleFindingIds(roleId);
    steps.push(
      {
        id: 'open-legislation',
        title: 'Legislative Analysis',
        narrative:
          `The shortcut opens Legislative Analysis. Locate “${lawDisplayTitle(lawId)}.”`,
        target: 'legislation-header',
        apply: baseApply({
          view: 'legislation',
          selectedFocuses: focuses,
          blendedIds: findingIds,
        }),
      },
      {
        id: 'open-law',
        title: lawDisplayTitle(lawId),
        narrative:
          `Open “${lawDisplayTitle(lawId)}” and read openings, blockers, and the primary-source pointer.`,
        target: 'law-object-page',
        apply: baseApply({
          view: 'law-object',
          activeLawId: lawId,
          selectedFocuses: focuses,
          blendedIds: findingIds,
        }),
      },
    );
    tryStartApply = baseApply({
      view: 'legislation',
      selectedFocuses: focuses,
      blendedIds: findingIds,
    });
  }

  return journeyShell({
    id: `guide-example:${roleId}:${guideStep.id}`,
    roleId,
    guideStepId: guideStep.id,
    pattern: 'role-home-actions',
    title: `${profile.shortLabel} primary action`,
    steps,
    tryStartApply,
  });
}

function evidenceIndexJourney(roleId, guideStep) {
  const profile = getRoleProfile(roleId);
  const roomId = INDEX_ROOM_BY_ROLE[roleId];
  const room = EVIDENCE_ROOMS.find((item) => item.id === roomId);
  const steps = [
    {
      id: 'open-index',
      title: 'Evidence Rooms index',
      narrative:
        `${profile.shortLabel} opens the Evidence Rooms index to choose the card that matches the example request.`,
      target: 'nav-evidence-index',
      apply: baseApply({
        view: 'evidence',
        activeEvidenceId: null,
      }),
    },
    {
      id: 'see-grid',
      title: 'Browse room cards',
      narrative:
        `Find the “${room?.title}” card in the index grid.`,
      target: 'evidence-index-grid',
      apply: baseApply({
        view: 'evidence',
        activeEvidenceId: null,
      }),
    },
    {
      id: 'pick-card',
      title: room?.title || roomId,
      narrative:
        `Open “${room?.title}” — the room named in this role’s index example.`,
      target: `evidence-index-card-${roomId}`,
      apply: baseApply({
        view: 'evidence',
        activeEvidenceId: null,
      }),
    },
    ...evidenceInvestigationSteps({
      roleId,
      roomId,
      openTarget: `evidence-index-card-${roomId}`,
      openNarrative:
        `${room?.title} opens with the filters and named object from the example.`,
      includeNav: false,
    }),
  ];

  return journeyShell({
    id: `guide-example:${roleId}:${guideStep.id}`,
    roleId,
    guideStepId: guideStep.id,
    pattern: 'evidence-index',
    title: `${profile.shortLabel} evidence index`,
    steps,
    tryStartApply: baseApply({
      view: 'evidence',
      activeEvidenceId: null,
    }),
  });
}

function roomJourney(roleId, guideStep, roomId) {
  const profile = getRoleProfile(roleId);
  const room = EVIDENCE_ROOMS.find((item) => item.id === roomId);
  const steps = evidenceInvestigationSteps({
    roleId,
    roomId,
    openTarget: `nav-room-${roomId}`,
    openNarrative:
      `${profile.shortLabel} opens ${room?.title} from the left navigation to answer the example question.`,
    includeNav: true,
  });

  return journeyShell({
    id: `guide-example:${roleId}:${guideStep.id}`,
    roleId,
    guideStepId: guideStep.id,
    pattern: 'evidence-investigation',
    title: `${profile.shortLabel}: ${room?.title}`,
    steps,
    tryStartApply: baseApply({
      view: 'evidence',
      activeEvidenceId: roomId,
      guidedFilters: { ...(ROOM_DEMO_SPECS[roomId]?.filters || {}) },
    }),
  });
}

/**
 * OFR-08: Funding & Resilience is a dedicated, state-neutral room outside
 * the Kentucky-only ALP cube engine (no ROOM_CONFIGS entry, no dimension
 * filters) — so it cannot reuse evidenceInvestigationSteps, which assumes
 * that engine. This builds an equivalent Show Me journey against the
 * room's real controls (signal-type chip filter, row drill-down).
 */
function fundingResilienceJourney(roleId, guideStep) {
  const profile = getRoleProfile(roleId);
  const roomId = 'funding-resilience';
  const room = EVIDENCE_ROOMS.find((item) => item.id === roomId);
  const guidedItemType = 'horizon-waiver';
  const guidedLeadTitleContains = 'TEAMKY';
  const leadTitle = 'the TEAMKY demonstration expiration row';

  const steps = [
    {
      id: 'nav-room',
      title: `Open ${room?.title || roomId}`,
      narrative: `${profile.shortLabel} opens ${room?.title} from the left navigation to answer the example question.`,
      target: `nav-room-${roomId}`,
      apply: baseApply({ view: 'evidence', activeEvidenceId: null }),
    },
    {
      id: 'open-room',
      title: room?.title || roomId,
      narrative: `Now you are in ${room?.title}. The header confirms this is the state-neutral funding-continuity and resilience evidence room.`,
      target: 'alp-analytical-header',
      apply: baseApply({ view: 'evidence', activeEvidenceId: roomId }),
    },
    {
      id: 'apply-filters',
      title: 'Filter by signal type',
      narrative: 'Filter to Waiver / demonstration horizon event to match the example question.',
      target: 'alp-visual-filters',
      apply: baseApply({ view: 'evidence', activeEvidenceId: roomId, guidedItemType }),
    },
    {
      id: 'read-chart',
      title: 'Read the filtered rows',
      narrative: `With that filter applied, scan the row list for “${leadTitle}.”`,
      target: 'alp-content',
      apply: baseApply({ view: 'evidence', activeEvidenceId: roomId, guidedItemType }),
    },
    {
      id: 'open-lead',
      title: 'Open the row',
      narrative: `Open “${leadTitle}” and carry its expiration date, source document citation, and retrieval date into the review.`,
      target: 'alp-content',
      apply: baseApply({ view: 'evidence', activeEvidenceId: roomId, guidedItemType, guidedLeadTitleContains }),
    },
    {
      id: 'check-lineage',
      title: 'Verify source lineage',
      narrative: 'Check the source lineage panel for the CMS demonstration page publisher, TOS grade, load status, and as-of date.',
      target: 'alp-lineage',
      apply: baseApply({ view: 'evidence', activeEvidenceId: roomId, guidedItemType, guidedLeadTitleContains }),
    },
  ];

  return journeyShell({
    id: `guide-example:${roleId}:${guideStep.id}`,
    roleId,
    guideStepId: guideStep.id,
    pattern: 'evidence-investigation',
    title: `${profile.shortLabel}: ${room?.title}`,
    steps,
    tryStartApply: baseApply({ view: 'evidence', activeEvidenceId: roomId, guidedItemType }),
  });
}

function blenderJourney(roleId, guideStep) {
  const profile = getRoleProfile(roleId);
  const focuses = profile.initialState.selectedFocuses;
  const findingIds = roleFindingIds(roleId);
  const findingTitles = roleFindingTitles(roleId);
  const focusLabels = roleFocusLabels(roleId);
  const weights = roleWeights(roleId);
  const packId = ROLE_PACK_IDS[roleId];
  const strongest = Object.entries(weights).sort((a, b) => b[1] - a[1])[0];
  const strongestLabel =
    FOCUS_TABS.find((focus) => focus.id === strongest?.[0])?.label || 'the leading focus';

  const steps = [
    {
      id: 'nav-blender',
      title: 'Open Consideration Blender',
      narrative:
        `${profile.shortLabel} opens the Consideration Blender from the left navigation.`,
      target: 'nav-blender',
      apply: baseApply({ view: 'role-home' }),
    },
    {
      id: 'blender-title',
      title: 'Consideration Blender',
      narrative:
        'The blender title confirms you are in the synthesis workspace for this example.',
      target: 'blender-title',
      apply: baseApply({
        view: 'blender',
        selectedFocuses: focuses,
        blendedIds: [],
        spineStep: 'Results',
      }),
    },
    {
      id: 'set-focuses',
      title: 'Select focus tabs',
      narrative:
        `Select ${formatList(focusLabels)} so the findings cover the lenses in the example.`,
      target: 'blender-focus-tabs',
      apply: baseApply({
        view: 'blender',
        selectedFocuses: focuses,
        blendedIds: [],
        spineStep: 'Results',
      }),
    },
    {
      id: 'add-findings',
      title: 'Add findings',
      narrative:
        `Add ${formatList(findingTitles)} to unlock pack comparison.`,
      target: 'blender-findings',
      apply: baseApply({
        view: 'blender',
        selectedFocuses: focuses,
        blendedIds: findingIds,
        spineStep: 'Results',
      }),
    },
    {
      id: 'set-weights',
      title: 'Adjust weights',
      narrative:
        `Set ${strongestLabel} to ${strongest?.[1] ?? 70} so ranking reflects this role’s decision priority.`,
      target: 'blender-weights',
      apply: baseApply({
        view: 'blender',
        selectedFocuses: focuses,
        blendedIds: findingIds,
        weights,
        spineStep: 'Results',
      }),
    },
    {
      id: 'trust',
      title: 'Walk Trust',
      narrative:
        'Open Trust and mark it reviewed only after freshness, source, and limitation caveats are stated.',
      target: 'blender-trust',
      apply: baseApply({
        view: 'blender',
        selectedFocuses: focuses,
        blendedIds: findingIds,
        weights,
        spineStep: 'Trust',
        trustReviewed: true,
      }),
    },
    {
      id: 'packs',
      title: 'Review option packs',
      narrative:
        `In Action, open “${packTitle(packId)}” as the demonstrated examination candidate — not a recommendation.`,
      target: 'blender-packs',
      apply: baseApply({
        view: 'blender',
        selectedFocuses: focuses,
        blendedIds: findingIds,
        weights,
        spineStep: 'Action',
        trustReviewed: true,
        activePackId: packId,
      }),
    },
  ];

  return journeyShell({
    id: `guide-example:${roleId}:${guideStep.id}`,
    roleId,
    guideStepId: guideStep.id,
    pattern: 'blender-synthesis',
    title: `${profile.shortLabel} blender example`,
    steps,
    tryStartApply: baseApply({
      view: 'blender',
      selectedFocuses: focuses,
      blendedIds: [],
      spineStep: 'Results',
    }),
  });
}

function packJourney(roleId, guideStep) {
  const profile = getRoleProfile(roleId);
  const focuses = profile.initialState.selectedFocuses;
  const findingIds = roleFindingIds(roleId);
  const weights = roleWeights(roleId);
  const packId = ROLE_PACK_IDS[roleId];
  const title = packTitle(packId);

  const steps = [
    {
      id: 'nav-pack',
      title: 'Open Win-Win-Win Pack',
      narrative:
        `${profile.shortLabel} opens the pack preview from the left navigation.`,
      target: 'nav-pack',
      apply: baseApply({
        view: 'blender',
        selectedFocuses: focuses,
        blendedIds: findingIds,
        weights,
        trustReviewed: true,
        activePackId: packId,
      }),
    },
    {
      id: 'pack-title',
      title,
      narrative:
        `“${title}” is the candidate named in the example. Confirm the disclaimer stays non-prescriptive.`,
      target: 'pack-title',
      apply: baseApply({
        view: 'pack',
        selectedFocuses: focuses,
        blendedIds: findingIds,
        weights,
        trustReviewed: true,
        activePackId: packId,
      }),
    },
    {
      id: 'pack-wins',
      title: 'Compare the three wins',
      narrative:
        'Compare Budget win, Constituent care win, and Political viability win, then read who may bear cost and why it might fail.',
      target: 'pack-wins',
      apply: baseApply({
        view: 'pack',
        selectedFocuses: focuses,
        blendedIds: findingIds,
        weights,
        trustReviewed: true,
        activePackId: packId,
      }),
    },
    {
      id: 'pack-details',
      title: 'Read failure modes and caveats',
      narrative:
        'Scroll the pack details for Who may bear cost, Why it might fail, and Trust caveats before deciding whether it belongs on the shortlist.',
      target: 'pack-details',
      apply: baseApply({
        view: 'pack',
        selectedFocuses: focuses,
        blendedIds: findingIds,
        weights,
        trustReviewed: true,
        activePackId: packId,
      }),
    },
  ];

  return journeyShell({
    id: `guide-example:${roleId}:${guideStep.id}`,
    roleId,
    guideStepId: guideStep.id,
    pattern: 'pack-review',
    title: `${profile.shortLabel} pack example`,
    steps,
    tryStartApply: baseApply({
      view: 'pack',
      selectedFocuses: focuses,
      blendedIds: findingIds,
      weights,
      trustReviewed: true,
      activePackId: packId,
    }),
  });
}

function briefJourney(roleId, guideStep) {
  const profile = getRoleProfile(roleId);
  const focuses = profile.initialState.selectedFocuses;
  const findingIds = roleFindingIds(roleId);
  const weights = roleWeights(roleId);
  const packId = ROLE_PACK_IDS[roleId];

  const steps = [
    {
      id: 'nav-brief',
      title: 'Open Consideration Brief',
      narrative:
        `${profile.shortLabel} opens the Consideration Brief to carry the pack into a portable record.`,
      target: 'nav-brief',
      apply: baseApply({
        view: 'pack',
        selectedFocuses: focuses,
        blendedIds: findingIds,
        weights,
        trustReviewed: true,
        activePackId: packId,
      }),
    },
    {
      id: 'brief-toolbar',
      title: 'Brief export toolbar',
      narrative:
        'Use the toolbar to export PDF or copy talking points while preserving sources and limitations.',
      target: 'brief-toolbar',
      apply: baseApply({
        view: 'brief',
        selectedFocuses: focuses,
        blendedIds: findingIds,
        weights,
        trustReviewed: true,
        activePackId: packId,
      }),
    },
    {
      id: 'brief-body',
      title: 'Review the carried evidence',
      narrative:
        'Scan the brief body for problem statement, evidence chain, pack comparison, trust gaps, and talking points.',
      target: 'brief-body',
      apply: baseApply({
        view: 'brief',
        selectedFocuses: focuses,
        blendedIds: findingIds,
        weights,
        trustReviewed: true,
        activePackId: packId,
      }),
    },
  ];

  return journeyShell({
    id: `guide-example:${roleId}:${guideStep.id}`,
    roleId,
    guideStepId: guideStep.id,
    pattern: 'brief-export',
    title: `${profile.shortLabel} brief example`,
    steps,
    tryStartApply: baseApply({
      view: 'brief',
      selectedFocuses: focuses,
      blendedIds: findingIds,
      weights,
      trustReviewed: true,
      activePackId: packId,
    }),
  });
}

function legislationJourney(roleId, guideStep) {
  const profile = getRoleProfile(roleId);
  const focuses = profile.initialState.selectedFocuses;
  const findingIds = roleFindingIds(roleId);
  const lawId = ROLE_LAW_IDS[roleId];
  const title = lawDisplayTitle(lawId);

  const steps = [
    {
      id: 'nav-legislation',
      title: 'Open Legislative Analysis',
      narrative:
        `${profile.shortLabel} opens Legislative Analysis to test the instrument named in the example.`,
      target: 'nav-legislation',
      apply: baseApply({
        view: 'role-home',
        selectedFocuses: focuses,
        blendedIds: findingIds,
      }),
    },
    {
      id: 'legislation-header',
      title: 'Legislative Analysis',
      narrative:
        `Locate “${title}” in the curated instrument list.`,
      target: 'legislation-header',
      apply: baseApply({
        view: 'legislation',
        selectedFocuses: focuses,
        blendedIds: findingIds,
      }),
    },
    {
      id: 'workspace',
      title: 'Law ↔ blender workspace',
      narrative:
        `Compare “${title}” with the active findings for openings, blockers, and relevance.`,
      target: 'legislation-workspace',
      apply: baseApply({
        view: 'legislation',
        selectedFocuses: focuses,
        blendedIds: findingIds,
      }),
    },
    {
      id: 'open-law',
      title,
      narrative:
        `Open “${title}” and read the Executive summary, Detailed analysis, and displayed relevance.`,
      target: 'law-object-page',
      apply: baseApply({
        view: 'law-object',
        activeLawId: lawId,
        selectedFocuses: focuses,
        blendedIds: findingIds,
      }),
    },
    {
      id: 'sources',
      title: 'Primary sources',
      narrative:
        'Follow the Primary authoritative source pointer and record any remaining official-verification requirement.',
      target: 'law-object-sources',
      apply: baseApply({
        view: 'law-object',
        activeLawId: lawId,
        selectedFocuses: focuses,
        blendedIds: findingIds,
      }),
    },
  ];

  return journeyShell({
    id: `guide-example:${roleId}:${guideStep.id}`,
    roleId,
    guideStepId: guideStep.id,
    pattern: 'legislative-linkage',
    title: `${profile.shortLabel} legislation example`,
    steps,
    tryStartApply: baseApply({
      view: 'legislation',
      selectedFocuses: focuses,
      blendedIds: findingIds,
    }),
  });
}

function askSamJourney(roleId, guideStep) {
  const profile = getRoleProfile(roleId);
  const prompt =
    `Which visible findings matter most for ${profile.shortLabel}, what should I verify, and which limitations belong in the briefing?`;
  const reply =
    `For ${profile.shortLabel}, start with the findings already on screen, verify owner/source/freshness for each cited figure, and keep every option framed as examination support — not a prescription. ${profile.askSamHint || ''}`.trim();

  const steps = [
    {
      id: 'nav-ask-sam',
      title: 'Open Ask Sam',
      narrative:
        `${profile.shortLabel} opens Ask Sam from the left navigation when the screen is dense.`,
      target: 'nav-ask-sam',
      apply: baseApply({
        view: 'role-home',
        askSamOpen: false,
      }),
    },
    {
      id: 'ask-sam-panel',
      title: 'Ask Sam panel',
      narrative:
        'The Ask Sam panel is open. Use the composer for the example question.',
      target: 'ask-sam-panel',
      apply: baseApply({
        view: 'role-home',
        askSamOpen: true,
      }),
    },
    {
      id: 'ask-sam-prompt',
      title: 'Submit the example question',
      narrative:
        `Ask: “${prompt}” Then use the cited screen context to continue.`,
      target: 'ask-sam-composer',
      apply: baseApply({
        view: 'role-home',
        askSamOpen: true,
        guidedAskSamPrompt: prompt,
        guidedAskSamReply: null,
      }),
    },
    {
      id: 'ask-sam-reply',
      title: 'Read Sam’s reply',
      narrative:
        'Sam returns a role-oriented answer that preserves synthetic-data, source, limitation, and non-prescriptive framing.',
      target: 'ask-sam-stream',
      apply: baseApply({
        view: 'role-home',
        askSamOpen: true,
        guidedAskSamPrompt: prompt,
        guidedAskSamReply: reply,
      }),
    },
  ];

  return journeyShell({
    id: `guide-example:${roleId}:${guideStep.id}`,
    roleId,
    guideStepId: guideStep.id,
    pattern: 'ask-sam',
    title: `${profile.shortLabel} Ask Sam example`,
    steps,
    tryStartApply: baseApply({
      view: 'role-home',
      askSamOpen: true,
    }),
  });
}

function buildJourneyForStep(roleId, guideStep) {
  if (guideStep.target === 'role-home-priorities') {
    return homePrioritiesJourney(roleId, guideStep);
  }
  if (guideStep.target === 'role-home-rooms') {
    return homeRoomsJourney(roleId, guideStep);
  }
  if (guideStep.target === 'role-home-actions') {
    return homeActionsJourney(roleId, guideStep);
  }
  if (guideStep.target === 'nav-evidence-index') {
    return evidenceIndexJourney(roleId, guideStep);
  }
  if (guideStep.target?.startsWith('nav-room-')) {
    if (guideStep.route.activeEvidenceId === 'funding-resilience') {
      return fundingResilienceJourney(roleId, guideStep);
    }
    return roomJourney(roleId, guideStep, guideStep.route.activeEvidenceId);
  }
  if (guideStep.target === 'nav-blender') {
    return blenderJourney(roleId, guideStep);
  }
  if (guideStep.target === 'nav-pack') {
    return packJourney(roleId, guideStep);
  }
  if (guideStep.target === 'nav-brief') {
    return briefJourney(roleId, guideStep);
  }
  if (guideStep.target === 'nav-legislation') {
    return legislationJourney(roleId, guideStep);
  }
  if (guideStep.target === 'nav-ask-sam') {
    return askSamJourney(roleId, guideStep);
  }
  return null;
}

function buildAllJourneys() {
  const map = {};
  for (const roleId of ROLE_IDS) {
    // Full destination sequence — Show Me coverage stays available even when the
    // on-screen Guide defaults to the short role-home orientation.
    for (const step of resolveRoleTourSteps(roleId, { includeDestinations: true })) {
      const journey = buildJourneyForStep(roleId, step);
      if (journey) map[journey.id] = journey;
    }
  }
  return map;
}

export const GUIDE_EXAMPLE_JOURNEYS = buildAllJourneys();

export function getGuideExampleJourney(roleId, guideStepId) {
  return GUIDE_EXAMPLE_JOURNEYS[`guide-example:${roleId}:${guideStepId}`] || null;
}

export function listGuideExampleJourneys() {
  return Object.values(GUIDE_EXAMPLE_JOURNEYS);
}

export function buildGuideExampleSteps(journey, { leadRow = null } = {}) {
  if (!journey?.steps?.length) return [];
  const roomId =
    journey.steps.find((s) => s.apply?.activeEvidenceId)?.apply.activeEvidenceId || null;
  const metricKey = ROOM_CONFIGS[roomId]?.metricKey;
  const metricLabel = ROOM_CONFIGS[roomId]?.metricLabel || 'Metric';
  const metricVal = leadRow && metricKey != null ? leadRow[metricKey] : null;
  const leadTitle = leadRow?.title || 'the lead aggregate';
  const leadMetric =
    metricVal == null
      ? 'the visible metric'
      : `${metricLabel} ${Number(metricVal).toLocaleString(undefined, { maximumFractionDigits: 1 })}`;

  return journey.steps.map((step) => {
    const narrative = String(step.narrative || '')
      .split('{leadTitle}').join(leadTitle)
      .split('{leadMetric}').join(leadMetric);
    const rawExample = step.choice
      ? 'Choose “Let me try it” to reset to the first task screen, or “Return to guide” to restore the previous walk-through.'
      : (step.example || '');
    const exampleText = String(rawExample || '').replace(/\s+/g, ' ').trim();
    const narrativeText = narrative.replace(/\s+/g, ' ').trim();
    const example =
      exampleText
      && exampleText.toLocaleLowerCase() !== narrativeText.toLocaleLowerCase()
        ? exampleText
        : '';
    return {
      ...step,
      preferredLeadTitle: step.preferredLeadTitle || journey.preferredLeadTitle,
      title: step.title,
      narrative,
      purpose: narrative,
      data: 'Controlled synthetic demo data for this guided example.',
      functionality: step.choice
        ? 'Choose whether to try the task yourself or return to the guide.'
        : 'Follow Next to apply the next guided state.',
      example,
      mode: 'show-me',
      choice: Boolean(step.choice),
      tryStartApply: step.tryStartApply || journey.tryStartApply,
    };
  });
}

export function validateGuideExampleFixtures({
  roleProfiles = ROLE_PROFILES,
  rooms = EVIDENCE_ROOMS,
  findings = FINDINGS,
  packs = OPTION_PACKS,
  laws = LAW_INSTRUMENTS,
} = {}) {
  const errors = [];
  const journeys = listGuideExampleJourneys();
  const expected = ROLE_IDS.length * 19;
  if (journeys.length !== expected) {
    errors.push(`expected ${expected} guide-example journeys, found ${journeys.length}`);
  }

  const roomSet = new Set(rooms.map((r) => r.id));
  const findingSet = new Set(findings.map((f) => f.id));
  const packSet = new Set(packs.map((p) => p.id));
  const lawSet = new Set(laws.map((l) => l.id));
  const journeyIds = new Set();

  for (const roleId of ROLE_IDS) {
    if (!roleProfiles[roleId]) errors.push(`missing role profile ${roleId}`);
    for (const step of resolveRoleTourSteps(roleId, { includeDestinations: true })) {
      const journey = getGuideExampleJourney(roleId, step.id);
      if (!journey) errors.push(`missing journey for ${roleId}:${step.id}`);
    }
  }

  for (const journey of journeys) {
    if (journeyIds.has(journey.id)) errors.push(`duplicate journey id ${journey.id}`);
    journeyIds.add(journey.id);
    if (!journey.steps?.length) errors.push(`${journey.id}: no steps`);
    if (!journey.tryStartApply) errors.push(`${journey.id}: missing tryStartApply`);
    const last = journey.steps?.[journey.steps.length - 1];
    if (!last?.choice) errors.push(`${journey.id}: final step must be a choice`);

    for (const step of journey.steps || []) {
      if (!step.id || !step.title || !step.narrative || !step.target) {
        errors.push(`${journey.id}: step missing id/title/narrative/target`);
      }
      const apply = step.apply || {};
      if (apply.activeEvidenceId && !roomSet.has(apply.activeEvidenceId)) {
        errors.push(`${journey.id}: invalid room ${apply.activeEvidenceId}`);
      }
      if (apply.activeLawId && !lawSet.has(apply.activeLawId)) {
        errors.push(`${journey.id}: invalid law ${apply.activeLawId}`);
      }
      if (apply.activePackId && !packSet.has(apply.activePackId)) {
        errors.push(`${journey.id}: invalid pack ${apply.activePackId}`);
      }
      if (Array.isArray(apply.blendedIds)) {
        for (const fid of apply.blendedIds) {
          if (!findingSet.has(fid)) errors.push(`${journey.id}: invalid finding ${fid}`);
        }
      }
      if (apply.guidedFilters) {
        for (const [key, value] of Object.entries(apply.guidedFilters)) {
          const allowed = DIM_IDS[key];
          if (!allowed) {
            errors.push(`${journey.id}: unknown filter dimension ${key}`);
            continue;
          }
          const ids = Array.isArray(value) ? value : [value];
          for (const id of ids) {
            if (!allowed.has(id)) errors.push(`${journey.id}: invalid ${key}=${id}`);
          }
        }
      }
      if (step.resolveLead && apply.activeEvidenceId) {
        const lead = resolveLeadRow(
          apply.activeEvidenceId,
          apply.guidedFilters || {},
          step.preferredLeadTitle || journey.preferredLeadTitle,
        );
        if (!lead) {
          errors.push(`${journey.id}:${step.id}: could not resolve preferred lead`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Resolve a lead for the first filtered evidence step in a guide-example journey. */
export function resolveGuideExampleLeadRow(journey) {
  const roomStep = journey?.steps?.find(
    (step) => Object.keys(step.apply?.guidedFilters || {}).length > 0
      && step.apply?.activeEvidenceId,
  ) || journey?.steps?.find((step) => step.apply?.activeEvidenceId);
  const roomId = roomStep?.apply?.activeEvidenceId;
  if (!roomId) return null;
  return resolveLeadRow(
    roomId,
    roomStep.apply.guidedFilters || {},
    roomStep.preferredLeadTitle || journey.preferredLeadTitle,
  );
}

// Touch listSlice so cube imports stay warm for validation helpers.
void listSlice;
