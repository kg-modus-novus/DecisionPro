import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EVIDENCE_ROOMS,
  FINDINGS,
  FOCUS_TABS,
  OPTION_PACKS,
  SPINE_STEPS,
} from './data/fixtures.js';
import {
  getRoleProfile,
  listRoleProfiles,
  orderedEvidenceRooms,
} from './data/roleProfiles.js';
import {
  resolveWalkthroughSteps,
  resolveNextWalkthroughRoute,
  roleTourKey,
  walkthroughTourKey,
} from './data/walkthroughs.js';
import {
  buildShowMeSteps,
  getShowMeJourney,
  resolveJourneyLeadRow,
  resolveLeadRow,
} from './data/showMeJourneys.js';
import {
  buildGuideExampleSteps,
  getGuideExampleJourney,
  resolveGuideExampleLeadRow,
} from './data/guideExampleJourneys.js';
import {
  buildBrief,
  findingDisplayWeight,
  normalizeWeights,
  radarProfile,
  rankOptionPacks,
} from './lib/blend.js';
import { EvidenceRoomScreen, EvidenceRoomsIndex } from './components/EvidenceRooms.jsx';
import { FundingResilienceRoom } from './components/FundingResilienceRoom.jsx';
import { ConsiderationBrief } from './components/ConsiderationBrief.jsx';
import { LegislativeAnalysis } from './components/LegislativeAnalysis.jsx';
import { LegislationObjectPage } from './components/LegislationObjectPage.jsx';
import { AskSamDock, formatSamRuntimeLabel } from './components/AskSamDock.jsx';
import { ChartPair } from './components/ChartPair.jsx';
import { PageTitleWithBack } from './components/ContentBackBar.jsx';
import { ExplainThisPage } from './components/ExplainThisPage.jsx';
import { GlossaryModal } from './components/GlossaryModal.jsx';
import { GlossaryText } from './components/GlossaryTerm.jsx';
import { DecisionProLogo } from './components/DecisionProLogo.jsx';
import { SpineStage, SPINE_CUES } from './components/SpineStage.jsx';
import { RoleSelector } from './components/RoleSelector.jsx';
import { StateLanding } from './components/StateLanding.jsx';
import { FloridaComparisonPage } from './components/FloridaComparisonPage.jsx';
import { RoleHome } from './components/RoleHome.jsx';
import { AuthoritativeSourcesPanel } from './components/AuthoritativeSourcesPanel.jsx';
import { OperationalIntelligence } from './components/OperationalIntelligence.jsx';
import {
  FL_EVIDENCE_ROOMS,
  FloridaDecisionSurface,
  FloridaEvidenceWorkspace,
  FloridaRoleHome,
  FloridaSourcesPanel,
} from './components/FloridaWorkspace.jsx';
import { UiZoomControl } from './components/UiZoomControl.jsx';
import { CalloutWalkthrough } from './components/CalloutWalkthrough.jsx';
import { FeedbackModal } from './components/FeedbackModal.jsx';
import { resolvePageExplain } from './lib/pageExplains.js';
import { buildAskSamEvidencePack } from './lib/askSamEvidencePack.js';
import { GlossaryProvider, useGlossary } from './lib/GlossaryContext.jsx';
import { NavHistoryContext } from './lib/navHistory.js';
import {
  clearWalkthroughSeen,
  hasSeenWalkthrough,
  isWalkthroughSkipAll,
  markWalkthroughSeen,
  setWalkthroughSkipAll,
  shouldAutoStartWalkthrough,
} from './lib/walkthroughSession.js';
import { isCompactLayout, readViewportLayout } from './lib/viewportLayout.js';
import { useViewportLayout } from './lib/useViewportLayout.js';
import {
  PRODUCT_FAMILY,
  getProductState,
  normalizeProductState,
  parseProductState,
} from './data/operationalIntelligence.js';

const DEFAULT_WEIGHTS = {
  budget: 50,
  care: 50,
  access: 50,
  mco: 50,
  district: 50,
  bill: 50,
};

const DEFAULT_NAV_WIDTH = 320;
const DEFAULT_SAM_HEIGHT = 420;

function sameNavSnapshot(a, b) {
  return (
    a.view === b.view
    && a.activeEvidenceId === b.activeEvidenceId
    && a.activeLawId === b.activeLawId
    && a.activePackId === b.activePackId
    && (a.evidenceObjectId ?? null) === (b.evidenceObjectId ?? null)
  );
}

function TopbarGlossaryButton() {
  const { openGlossary } = useGlossary();
  return (
    <button
      type="button"
      className="explain-page-btn"
      onClick={() => openGlossary()}
      title="Open DecisionPro glossary"
    >
      Glossary
    </button>
  );
}

export default function App() {
  return (
    <GlossaryProvider>
      <AppShell />
    </GlossaryProvider>
  );
}

function AppShell() {
  const initialProductState = useRef(null);
  if (initialProductState.current === null) {
    const state = new URLSearchParams(window.location.search).get('state');
    initialProductState.current = parseProductState(state) || 'NEUTRAL';
  }
  const initialStateCode = initialProductState.current === 'NEUTRAL'
    ? null
    : initialProductState.current;
  const [productStateCode, setProductStateCode] = useState(initialStateCode);
  const [view, setView] = useState(() => {
    if (initialStateCode) return 'role-selector';
    return new URLSearchParams(window.location.search).get('compare')?.toUpperCase() === 'FL'
      ? 'fl-comparison'
      : 'state-selector';
  });
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedFocuses, setSelectedFocuses] = useState(['budget', 'care']);
  const [blendedIds, setBlendedIds] = useState([]);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [spineStep, setSpineStep] = useState('Results');
  const [spineVisited, setSpineVisited] = useState(() => new Set(['Results']));
  const [trustReviewed, setTrustReviewed] = useState(false);
  const [pathPinned, setPathPinned] = useState(false);
  const [activePackId, setActivePackId] = useState(null);
  const [activeEvidenceId, setActiveEvidenceId] = useState(null);
  const [activeLawId, setActiveLawId] = useState(null);
  const [evidenceObjectId, setEvidenceObjectId] = useState(null);
  const [navDepth, setNavDepth] = useState(0);
  const navStackRef = useRef([]);
  const [askSamOpen, setAskSamOpen] = useState(() => readViewportLayout() !== 'handheld');
  const [askSamStatus, setAskSamStatus] = useState(null);
  const onAskSamStatusChange = useCallback((next) => setAskSamStatus(next), []);
  const [navCollapsed, setNavCollapsed] = useState(() => isCompactLayout(readViewportLayout()));
  const [navWidth, setNavWidth] = useState(DEFAULT_NAV_WIDTH);
  const [samPanelHeight, setSamPanelHeight] = useState(DEFAULT_SAM_HEIGHT);
  const [explainOpen, setExplainOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('suggestion');
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [continueWalkthroughPending, setContinueWalkthroughPending] = useState(false);
  const [walkthroughResumeIndex, setWalkthroughResumeIndex] = useState(0);
  const [showMeOpen, setShowMeOpen] = useState(false);
  const [showMeSteps, setShowMeSteps] = useState([]);
  const [showMeSnapshot, setShowMeSnapshot] = useState(null);
  const [showMeOrigin, setShowMeOrigin] = useState(null);
  const [guidedFilters, setGuidedFilters] = useState(null);
  const [guidedViewMode, setGuidedViewMode] = useState(null);
  const [guidedObjectFacet, setGuidedObjectFacet] = useState(null);
  const [guidedLeadItemId, setGuidedLeadItemId] = useState(null);
  const [guidedItemType, setGuidedItemType] = useState(null);
  const [guidedLeadTitleContains, setGuidedLeadTitleContains] = useState(null);
  const [guidedAskSamPrompt, setGuidedAskSamPrompt] = useState(null);
  const [guidedAskSamReply, setGuidedAskSamReply] = useState(null);
  const [highlightPriorityId, setHighlightPriorityId] = useState(null);
  const [roomEntryFilters, setRoomEntryFilters] = useState(null);
  const [roomEntryViewMode, setRoomEntryViewMode] = useState(null);
  const [sourcesFocusId, setSourcesFocusId] = useState(null);
  const [sourcesFocusTab, setSourcesFocusTab] = useState(null);
  const [sourcesFocusNonce, setSourcesFocusNonce] = useState(0);
  const [tileInfoFocus, setTileInfoFocus] = useState(null);
  const showMeLeadRef = useRef(null);
  const walkthroughIndexRef = useRef(0);
  const leftNavRef = useRef(null);
  const contentColumnRef = useRef(null);
  const navWidthBeforeCollapse = useRef(DEFAULT_NAV_WIDTH);
  const viewportLayout = useViewportLayout();
  const compactLayout = isCompactLayout(viewportLayout);
  const layoutRef = useRef(viewportLayout);
  const navCollapsedRef = useRef(navCollapsed);
  const walkthroughOpenRef = useRef(walkthroughOpen);
  const showMeOpenRef = useRef(showMeOpen);
  layoutRef.current = viewportLayout;
  navCollapsedRef.current = navCollapsed;
  walkthroughOpenRef.current = walkthroughOpen;
  showMeOpenRef.current = showMeOpen;

  const product = useMemo(
    () => (productStateCode ? getProductState(productStateCode) : PRODUCT_FAMILY),
    [productStateCode],
  );
  const isFlorida = productStateCode === 'FL';

  useEffect(() => {
    document.title = view === 'fl-comparison'
      ? 'DecisionPro Florida — Public Dashboard Comparison'
      : `${product.brand} — ${product.subtitle}`;
  }, [product, view]);

  const roleProfile = useMemo(() => getRoleProfile(selectedRole), [selectedRole]);
  const orderedRooms = useMemo(
    () => (isFlorida ? FL_EVIDENCE_ROOMS : orderedEvidenceRooms(selectedRole, EVIDENCE_ROOMS)),
    [selectedRole, isFlorida],
  );

  const blenderActive = view === 'blender' || view === 'pack' || view === 'brief';
  const evidenceActive = view === 'evidence';
  const sourcesActive = view === 'sources';
  const operationalActive = view === 'operational';
  const legislationActive = view === 'legislation' || view === 'law-object';
  const selectionGate = view === 'role-selector' || view === 'state-selector' || view === 'fl-comparison';
  const showChrome = !selectionGate;

  useEffect(() => {
    if (productStateCode !== null) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('state')) return;
    url.searchParams.delete('state');
    window.history.replaceState({ dpNav: true, depth: 0 }, '', `${url.pathname}${url.search}${url.hash}`);
  }, [productStateCode]);

  useEffect(() => {
    if (isCompactLayout(viewportLayout)) {
      setNavCollapsed(true);
      if (viewportLayout === 'handheld') setAskSamOpen(false);
      return;
    }
    if (showChrome) setNavCollapsed(false);
  }, [viewportLayout, showChrome]);

  const walkthroughSteps = useMemo(
    () => resolveWalkthroughSteps({
      roleId: selectedRole,
      view,
      evidenceId: activeEvidenceId,
      evidenceObjectId,
      lawId: activeLawId,
    }),
    [selectedRole, view, activeEvidenceId, evidenceObjectId, activeLawId],
  );
  const activeWalkthroughKey = walkthroughTourKey({
    stateCode: productStateCode,
    roleId: selectedRole,
    view,
    evidenceId: activeEvidenceId,
    evidenceObjectId,
    lawId: activeLawId,
  });
  const nextWalkthroughRoute = resolveNextWalkthroughRoute({
    roleId: selectedRole,
    view,
    evidenceId: activeEvidenceId,
    evidenceObjectId,
    lawId: activeLawId,
  });
  const guideNeedsAttention = Boolean(
    activeWalkthroughKey
      && !hasSeenWalkthrough(activeWalkthroughKey)
      && !isWalkthroughSkipAll(),
  );

  useEffect(() => {
    if (!continueWalkthroughPending || !activeWalkthroughKey || !walkthroughSteps.length) return;
    setWalkthroughResumeIndex(0);
    walkthroughIndexRef.current = 0;
    setWalkthroughOpen(true);
    setContinueWalkthroughPending(false);
  }, [continueWalkthroughPending, activeWalkthroughKey, walkthroughSteps.length]);

  function captureContentScroll() {
    return contentColumnRef.current?.scrollTop ?? 0;
  }

  function restoreContentScroll(top) {
    const y = Math.max(0, Number(top) || 0);
    const apply = () => {
      const pane = contentColumnRef.current;
      if (!pane) return;
      pane.scrollTop = y;
    };
    apply();
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
    // Evidence / ALP remount can settle after the first paint.
    window.setTimeout(apply, 50);
    window.setTimeout(apply, 160);
  }

  function captureNavSnapshot() {
    return {
      view,
      activeEvidenceId,
      activeLawId,
      activePackId,
      evidenceObjectId,
      contentScrollTop: captureContentScroll(),
    };
  }

  function applyNavSnapshot(snap) {
    setView(snap.view);
    setActiveEvidenceId(snap.activeEvidenceId);
    setActiveLawId(snap.activeLawId);
    setActivePackId(snap.activePackId);
    setEvidenceObjectId(snap.evidenceObjectId ?? null);
    if (snap.tileInfoFocus) {
      setTileInfoFocus({ ...snap.tileInfoFocus, nonce: Date.now() });
    } else {
      setTileInfoFocus(null);
    }
    restoreContentScroll(snap.contentScrollTop);
  }

  function hideNavOnCompactNavigate() {
    if (!isCompactLayout(layoutRef.current)) return;
    if (walkthroughOpenRef.current || showMeOpenRef.current) return;
    setNavCollapsed(true);
  }

  function navigate(patch = {}, meta = {}) {
    const current = captureNavSnapshot();
    if (meta.fromTileInfo) current.tileInfoFocus = meta.fromTileInfo;
    const next = { ...current, ...patch };
    delete next.tileInfoFocus;
    if (sameNavSnapshot(current, next)) return;
    navStackRef.current = [...navStackRef.current, current];
    setNavDepth(navStackRef.current.length);
    if ('view' in patch) setView(patch.view);
    if ('activeEvidenceId' in patch) setActiveEvidenceId(patch.activeEvidenceId);
    if ('activeLawId' in patch) setActiveLawId(patch.activeLawId);
    if ('activePackId' in patch) setActivePackId(patch.activePackId);
    if ('evidenceObjectId' in patch) setEvidenceObjectId(patch.evidenceObjectId);
    setTileInfoFocus(null);
    hideNavOnCompactNavigate();
    window.history.pushState(
      { dpNav: true, depth: navStackRef.current.length },
      '',
    );
    // New view or object starts at top; Back restores the snapshot's contentScrollTop.
    const objectChanged =
      'evidenceObjectId' in patch
      && (patch.evidenceObjectId ?? null) !== (current.evidenceObjectId ?? null);
    if ((patch.view && patch.view !== current.view) || objectChanged) {
      requestAnimationFrame(scrollContentToTop);
    }
  }

  function goBack() {
    // On tablet/handheld, Back first reopens the auto-hidden left nav.
    if (isCompactLayout(layoutRef.current) && navCollapsedRef.current) {
      setNavCollapsed(false);
      return;
    }
    if (!navStackRef.current.length) return;
    // Browser Back and in-app Back share one stack via popstate.
    window.history.back();
  }

  useEffect(() => {
    if (!window.history.state?.dpNav) {
      window.history.replaceState({ dpNav: true, depth: 0 }, '');
    }
    function onPopState() {
      if (!navStackRef.current.length) {
        window.history.replaceState({ dpNav: true, depth: 0 }, '');
        return;
      }
      const prev = navStackRef.current[navStackRef.current.length - 1];
      navStackRef.current = navStackRef.current.slice(0, -1);
      setNavDepth(navStackRef.current.length);
      applyNavSnapshot(prev);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function applyRoleDefaults(roleId, { pushHistory = true } = {}) {
    const profile = getRoleProfile(roleId);
    if (!profile) return;
    const init = profile.initialState || {};
    setSelectedRole(roleId);
    setSelectedFocuses(init.selectedFocuses || ['budget', 'care']);
    setWeights({ ...DEFAULT_WEIGHTS, ...(init.weights || {}) });
    setActiveEvidenceId(init.activeEvidenceId || null);
    setEvidenceObjectId(null);
    setActiveLawId(null);
    setActivePackId(null);
    setBlendedIds([]);
    setSpineStep('Results');
    setSpineVisited(new Set(['Results']));
    setTrustReviewed(false);
    setPathPinned(false);
    const nextView = init.view || 'role-home';
    if (pushHistory) {
      navigate({
        view: nextView,
        activeEvidenceId: init.activeEvidenceId || null,
        evidenceObjectId: null,
        activeLawId: null,
        activePackId: null,
      });
    } else {
      setView(nextView);
      navStackRef.current = [];
      setNavDepth(0);
      setTileInfoFocus(null);
      window.history.replaceState({ dpNav: true, depth: 0 }, '');
    }
  }

  function selectRole(roleId) {
    applyRoleDefaults(roleId, { pushHistory: Boolean(selectedRole) });
    setWalkthroughResumeIndex(0);
    walkthroughIndexRef.current = 0;
    // Bubble guide stays manual on narrow screens — content needs the viewport.
    const autoGuide = shouldAutoStartWalkthrough(walkthroughTourKey({ stateCode: productStateCode, roleId, view: 'role-home' }))
      && !isCompactLayout(layoutRef.current);
    setWalkthroughOpen(autoGuide);
  }

  function openRoleSelector() {
    if (!productStateCode) return;
    navigate({
      view: 'role-selector',
      evidenceObjectId: null,
      activeLawId: null,
    });
  }

  function openStateLanding() {
    setProductStateCode(null);
    setSelectedRole(null);
    setView('state-selector');
    setWalkthroughOpen(false);
    setShowMeOpen(false);
    setAskSamOpen(false);
    setActiveEvidenceId(null);
    setEvidenceObjectId(null);
    setActiveLawId(null);
    setActivePackId(null);
    setTileInfoFocus(null);
    navStackRef.current = [];
    setNavDepth(0);

    const url = new URL(window.location.href);
    url.searchParams.delete('state');
    url.searchParams.delete('compare');
    window.history.replaceState({ dpNav: true, depth: 0 }, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function openFloridaComparison() {
    setProductStateCode(null);
    setSelectedRole(null);
    setView('fl-comparison');
    const url = new URL(window.location.href);
    url.searchParams.delete('state');
    url.searchParams.set('compare', 'FL');
    window.history.replaceState({ dpNav: true, depth: 0 }, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function selectProductState(value, { entryRoomId = null } = {}) {
    const next = normalizeProductState(value);
    setProductStateCode(next);
    setSelectedRole(null);
    setView('role-selector');
    setWalkthroughOpen(false);
    setShowMeOpen(false);
    setAskSamOpen(next !== 'FL' && readViewportLayout() !== 'handheld');
    navStackRef.current = [];
    setNavDepth(0);

    const url = new URL(window.location.href);
    url.searchParams.delete('compare');
    url.searchParams.set('state', next);
    window.history.replaceState({ dpNav: true, depth: 0 }, '', `${url.pathname}${url.search}${url.hash}`);

    if (entryRoomId) {
      // This room's content doesn't vary by role (unlike role-home), so a
      // direct content link skips the role-selector screen entirely rather
      // than making the visitor pick a perspective just to see it. A
      // sensible default role still gets applied underneath so the rest of
      // the shell (nav, Blender defaults) works normally; the visitor can
      // switch roles afterward from the header.
      applyRoleDefaults('legislator', { pushHistory: false });
      openEvidenceRoom(entryRoomId);
      return;
    }
  }

  function switchProductState(value) {
    const next = normalizeProductState(value);
    if (next === productStateCode) return;
    setProductStateCode(next);
    setWalkthroughOpen(false);
    setShowMeOpen(false);
    setAskSamOpen(next !== 'FL' && readViewportLayout() !== 'handheld');
    setActiveEvidenceId(null);
    setEvidenceObjectId(null);
    setActiveLawId(null);
    setActivePackId(null);
    setTileInfoFocus(null);
    setView(selectedRole ? 'role-home' : 'role-selector');
    navStackRef.current = [];
    setNavDepth(0);

    const url = new URL(window.location.href);
    url.searchParams.set('state', next);
    window.history.replaceState({ dpNav: true, depth: 0 }, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function openLawInstrument(id) {
    if (!id) return;
    navigate({ view: 'law-object', activeLawId: id });
  }

  function scrollContentToTop() {
    const pane = contentColumnRef.current;
    if (!pane) return;
    pane.scrollTop = 0;
    pane.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  }

  function openEvidenceRoom(id, options = {}) {
    setRoomEntryFilters(options.filters || null);
    setRoomEntryViewMode(options.viewMode || null);
    navigate({
      view: 'evidence',
      activeEvidenceId: id,
      evidenceObjectId: null,
      activeLawId: null,
    });
    // Content column stays mounted across rooms — reset so the new ALP starts at top.
    scrollContentToTop();
    requestAnimationFrame(scrollContentToTop);
  }

  function openBlender() {
    navigate({ view: 'blender', evidenceObjectId: null });
  }

  function handleRoleHomeAction(action) {
    if (!action) return;
    if (action.view === 'blender') {
      openBlender();
      return;
    }
    if (action.view === 'legislation') {
      navigate({ view: 'legislation', activeLawId: null, evidenceObjectId: null });
      return;
    }
    if (action.view === 'evidence') {
      openEvidenceRoom(action.evidenceId || null);
    }
  }

  function openRoleHomeSmartTile(tile) {
    const destination = tile?.destination;
    if (!destination) return;

    if (destination.focuses) setSelectedFocuses([...destination.focuses]);
    if (destination.weights) {
      setWeights({ ...DEFAULT_WEIGHTS, ...destination.weights });
    }
    if (destination.findings) setBlendedIds([...destination.findings]);

    if (destination.view === 'evidence') {
      openEvidenceRoom(destination.roomId, {
        filters: destination.filters,
        viewMode: destination.viewMode || 'hybrid',
      });
      return;
    }
    if (destination.view === 'blender') {
      setSpineStep('Results');
      setSpineVisited(new Set(['Results']));
      setTrustReviewed(false);
      setPathPinned(false);
      openBlender();
      return;
    }
    if (destination.view === 'legislation') {
      navigate({ view: 'legislation', activeLawId: null, evidenceObjectId: null });
      return;
    }
    if (destination.view === 'sources') {
      setSourcesFocusId(destination.fromSysId || null);
      setSourcesFocusTab(destination.sourcesTab || 'sources');
      setSourcesFocusNonce((n) => n + 1);
      navigate({ view: 'sources', evidenceObjectId: null });
      return;
    }
    if (destination.view === 'role-home') {
      navigate({ view: 'role-home', evidenceObjectId: null });
    }
  }

  function openAuthoritativeSources(fromSysId = null, options = {}) {
    setSourcesFocusId(fromSysId);
    setSourcesFocusTab(options.tab || 'sources');
    setSourcesFocusNonce((n) => n + 1);
    navigate(
      { view: 'sources', evidenceObjectId: null },
      { fromTileInfo: options.restoreTileInfo || null },
    );
  }

  function closeWalkthrough({ markSeen = true } = {}) {
    if (markSeen) markWalkthroughSeen(activeWalkthroughKey);
    setWalkthroughOpen(false);
  }

  function skipAllWalkthroughs() {
    setWalkthroughSkipAll(true);
    markWalkthroughSeen(activeWalkthroughKey);
    setWalkthroughOpen(false);
  }

  function replayWalkthrough() {
    if (!activeWalkthroughKey) return;
    clearWalkthroughSeen(activeWalkthroughKey);
    setWalkthroughResumeIndex(0);
    walkthroughIndexRef.current = 0;
    setWalkthroughOpen(true);
  }

  function continueWalkthroughOnNextPage() {
    if (!nextWalkthroughRoute) return;
    markWalkthroughSeen(activeWalkthroughKey);
    setWalkthroughOpen(false);
    setContinueWalkthroughPending(true);
    navigate(nextWalkthroughRoute);
  }

  function showWalkthroughStep(step, index = 0) {
    walkthroughIndexRef.current = index;
    if (!step?.route) return;
    const route = step.route;
    setNavCollapsed(false);
    if ('view' in route) setView(route.view);
    if ('activeEvidenceId' in route) setActiveEvidenceId(route.activeEvidenceId);
    if ('activeLawId' in route) setActiveLawId(route.activeLawId);
    if ('activePackId' in route) setActivePackId(route.activePackId);
    if ('evidenceObjectId' in route) setEvidenceObjectId(route.evidenceObjectId);
    if ('askSamOpen' in route) setAskSamOpen(route.askSamOpen);
  }

  function captureShowMeSnapshot() {
    return {
      view,
      activeEvidenceId,
      activeLawId,
      activePackId,
      evidenceObjectId,
      selectedFocuses,
      blendedIds,
      weights,
      spineStep,
      trustReviewed,
      pathPinned,
      askSamOpen,
      guidedFilters,
      guidedViewMode,
      guidedObjectFacet,
      guidedLeadItemId,
      guidedItemType,
      guidedLeadTitleContains,
      guidedAskSamPrompt,
      guidedAskSamReply,
      highlightPriorityId,
      walkthroughOpen,
      walkthroughIndex: walkthroughIndexRef.current,
    };
  }

  function clearGuidedSurfaces() {
    setGuidedFilters(null);
    setGuidedViewMode(null);
    setGuidedObjectFacet(null);
    setGuidedLeadItemId(null);
    setGuidedItemType(null);
    setGuidedLeadTitleContains(null);
    setGuidedAskSamPrompt(null);
    setGuidedAskSamReply(null);
    showMeLeadRef.current = null;
  }

  function applyShowMeStep(step) {
    if (!step?.apply) return;
    const apply = step.apply;
    setNavCollapsed(false);

    let leadRow = showMeLeadRef.current;
    const roomId = apply.activeEvidenceId;
    const filters = apply.guidedFilters || {};
    if (step.resolveLead && roomId) {
      leadRow = resolveLeadRow(roomId, filters, step.preferredLeadTitle);
      showMeLeadRef.current = leadRow;
      if (leadRow) setGuidedLeadItemId(leadRow.id);
    }

    if ('view' in apply) setView(apply.view);
    if ('activeEvidenceId' in apply) setActiveEvidenceId(apply.activeEvidenceId);
    if ('activeLawId' in apply) setActiveLawId(apply.activeLawId);
    if ('activePackId' in apply) setActivePackId(apply.activePackId);
    if ('askSamOpen' in apply) setAskSamOpen(apply.askSamOpen);
    if ('selectedFocuses' in apply) setSelectedFocuses(apply.selectedFocuses);
    if ('blendedIds' in apply) setBlendedIds(apply.blendedIds);
    if ('weights' in apply) setWeights({ ...DEFAULT_WEIGHTS, ...apply.weights });
    if ('spineStep' in apply) {
      setSpineStep(apply.spineStep);
      setSpineVisited((prev) => new Set([...prev, apply.spineStep]));
    }
    if ('trustReviewed' in apply) setTrustReviewed(apply.trustReviewed);
    if ('pathPinned' in apply) setPathPinned(apply.pathPinned);

    if ('guidedFilters' in apply) {
      setGuidedFilters(apply.guidedFilters && Object.keys(apply.guidedFilters).length
        ? { ...apply.guidedFilters }
        : {});
    }
    if ('viewMode' in apply) setGuidedViewMode(apply.viewMode);
    if ('objectFacet' in apply) setGuidedObjectFacet(apply.objectFacet);
    if ('guidedItemType' in apply) setGuidedItemType(apply.guidedItemType);
    if ('guidedLeadTitleContains' in apply) setGuidedLeadTitleContains(apply.guidedLeadTitleContains);
    if ('highlightPriorityId' in apply) setHighlightPriorityId(apply.highlightPriorityId);
    if ('guidedAskSamPrompt' in apply) setGuidedAskSamPrompt(apply.guidedAskSamPrompt);
    if ('guidedAskSamReply' in apply) setGuidedAskSamReply(apply.guidedAskSamReply);

    if ('evidenceObjectId' in apply) {
      if (apply.evidenceObjectId === '__lead__') {
        setEvidenceObjectId(leadRow?.id || null);
      } else {
        setEvidenceObjectId(apply.evidenceObjectId);
      }
    }
  }

  function restoreShowMeSnapshot(snap) {
    if (!snap) return;
    setView(snap.view);
    setActiveEvidenceId(snap.activeEvidenceId);
    setActiveLawId(snap.activeLawId);
    setActivePackId(snap.activePackId);
    setEvidenceObjectId(snap.evidenceObjectId);
    setSelectedFocuses(snap.selectedFocuses);
    setBlendedIds(snap.blendedIds);
    setWeights(snap.weights);
    setSpineStep(snap.spineStep);
    setTrustReviewed(snap.trustReviewed);
    setPathPinned(snap.pathPinned);
    setAskSamOpen(snap.askSamOpen);
    setGuidedFilters(snap.guidedFilters);
    setGuidedViewMode(snap.guidedViewMode);
    setGuidedObjectFacet(snap.guidedObjectFacet);
    setGuidedLeadItemId(snap.guidedLeadItemId);
    setGuidedItemType(snap.guidedItemType ?? null);
    setGuidedLeadTitleContains(snap.guidedLeadTitleContains ?? null);
    setGuidedAskSamPrompt(snap.guidedAskSamPrompt ?? null);
    setGuidedAskSamReply(snap.guidedAskSamReply ?? null);
    setHighlightPriorityId(snap.highlightPriorityId);
  }

  function startShowMe(priority) {
    const journey = getShowMeJourney(priority?.showMeJourneyId);
    if (!journey) return;
    setWalkthroughOpen(false);
    setShowMeOrigin({ kind: 'priority', priorityId: priority.id });
    setShowMeSnapshot(captureShowMeSnapshot());
    showMeLeadRef.current = null;
    const leadRow = resolveJourneyLeadRow(journey);
    showMeLeadRef.current = leadRow;
    if (leadRow) setGuidedLeadItemId(leadRow.id);
    const steps = buildShowMeSteps(journey, { leadRow });
    setShowMeSteps(steps);
    setShowMeOpen(true);
    if (steps[0]) applyShowMeStep(steps[0]);
  }

  function startGuideExample(guideStep, guideIndex) {
    if (!selectedRole || !guideStep?.id) return;
    const journey = getGuideExampleJourney(selectedRole, guideStep.id);
    if (!journey) return;
    walkthroughIndexRef.current = guideIndex;
    setWalkthroughResumeIndex(guideIndex);
    setWalkthroughOpen(false);
    setShowMeOrigin({
      kind: 'guide-example',
      guideStepId: guideStep.id,
      guideIndex,
    });
    setShowMeSnapshot(captureShowMeSnapshot());
    showMeLeadRef.current = null;
    const leadRow = resolveGuideExampleLeadRow(journey);
    showMeLeadRef.current = leadRow;
    if (leadRow) setGuidedLeadItemId(leadRow.id);
    const steps = buildGuideExampleSteps(journey, { leadRow });
    setShowMeSteps(steps);
    setShowMeOpen(true);
    if (steps[0]) applyShowMeStep(steps[0]);
  }

  function exitShowMe({ restoreSnapshot = true } = {}) {
    const origin = showMeOrigin;
    const snap = showMeSnapshot;
    setShowMeOpen(false);
    setShowMeSteps([]);
    clearGuidedSurfaces();
    setShowMeOrigin(null);
    setShowMeSnapshot(null);
    if (restoreSnapshot && snap) {
      restoreShowMeSnapshot(snap);
      if (origin?.kind === 'guide-example') {
        setWalkthroughResumeIndex(origin.guideIndex ?? snap.walkthroughIndex ?? 0);
        setWalkthroughOpen(true);
      }
    } else if (!restoreSnapshot) {
      setView('role-home');
      setEvidenceObjectId(null);
      setActiveLawId(null);
      setActivePackId(null);
    }
  }

  function completeShowMe() {
    const origin = showMeOrigin;
    setShowMeOpen(false);
    setShowMeSteps([]);
    setShowMeSnapshot(null);
    setShowMeOrigin(null);
    clearGuidedSurfaces();
    if (origin?.kind === 'guide-example') {
      setWalkthroughResumeIndex(origin.guideIndex || 0);
      setWalkthroughOpen(true);
    }
  }

  function tryGuideExample(step) {
    const start = step?.tryStartApply;
    setShowMeOpen(false);
    setShowMeSteps([]);
    setShowMeSnapshot(null);
    setShowMeOrigin(null);
    clearGuidedSurfaces();
    setWalkthroughOpen(false);
    if (start) {
      applyShowMeStep({ apply: start });
      setGuidedFilters(null);
      setGuidedViewMode(null);
      setGuidedObjectFacet(null);
      setGuidedLeadItemId(null);
      setGuidedAskSamPrompt(null);
      setGuidedAskSamReply(null);
      setHighlightPriorityId(null);
    } else {
      setView('role-home');
    }
  }

  function returnGuideExample() {
    const origin = showMeOrigin;
    const snap = showMeSnapshot;
    setShowMeOpen(false);
    setShowMeSteps([]);
    clearGuidedSurfaces();
    setShowMeOrigin(null);
    setShowMeSnapshot(null);
    if (snap) restoreShowMeSnapshot(snap);
    setWalkthroughResumeIndex(origin?.guideIndex ?? snap?.walkthroughIndex ?? 0);
    setWalkthroughOpen(true);
  }

  const navHistory = useMemo(
    () => ({
      canGoBack: navDepth > 0 || (compactLayout && navCollapsed),
      goBack,
      navigate,
      revealsNav: compactLayout && navCollapsed,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable imperative helpers; depth drives canGoBack
    [navDepth, view, activeEvidenceId, activeLawId, activePackId, evidenceObjectId, compactLayout, navCollapsed],
  );

  function maxSamPanelHeight() {
    const navH = leftNavRef.current?.clientHeight || window.innerHeight;
    return Math.floor(navH * 0.8);
  }

  function toggleAskSam() {
    setAskSamOpen((open) => {
      const next = !open;
      if (next && navWidth < 300) setNavWidth(320);
      if (next) {
        const maxH = maxSamPanelHeight();
        setSamPanelHeight((h) => Math.min(Math.max(h, 340), maxH));
      }
      return next;
    });
  }

  function toggleNavCollapse() {
    setNavCollapsed((collapsed) => {
      if (!collapsed) {
        navWidthBeforeCollapse.current = navWidth;
        return true;
      }
      setNavWidth(Math.max(200, navWidthBeforeCollapse.current || DEFAULT_NAV_WIDTH));
      return false;
    });
  }

  function startNavWidthDrag(event) {
    if (navCollapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startW = navWidth;
    function onMove(ev) {
      setNavWidth(Math.min(560, Math.max(200, startW + (ev.clientX - startX))));
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('is-resizing-nav');
    }
    document.body.classList.add('is-resizing-nav');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function startSamHeightDrag(event) {
    event.preventDefault();
    const startY = event.clientY;
    const startH = samPanelHeight;
    const maxH = maxSamPanelHeight();
    function onMove(ev) {
      setSamPanelHeight(Math.min(maxH, Math.max(160, startH - (ev.clientY - startY))));
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('is-resizing-sam');
    }
    document.body.classList.add('is-resizing-sam');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  const availableFindings = useMemo(
    () => FINDINGS.filter((f) => selectedFocuses.includes(f.focusId)),
    [selectedFocuses],
  );

  const blendedFindings = useMemo(
    () => FINDINGS.filter((f) => blendedIds.includes(f.id)),
    [blendedIds],
  );

  const normalizedWeights = useMemo(() => normalizeWeights(weights), [weights]);
  const rankedPacks = useMemo(
    () => rankOptionPacks(OPTION_PACKS, normalizedWeights, blendedFindings),
    [normalizedWeights, blendedFindings],
  );
  const radar = useMemo(
    () => radarProfile(blendedFindings, normalizedWeights),
    [blendedFindings, normalizedWeights],
  );
  const brief = useMemo(
    () =>
      buildBrief({
        focuses: selectedFocuses,
        findings: blendedFindings,
        weights: normalizedWeights,
        packs: OPTION_PACKS,
        spineStep,
        trustReviewed,
        pathPinned,
      }),
    [selectedFocuses, blendedFindings, normalizedWeights, spineStep, trustReviewed, pathPinned],
  );

  const activePack = rankedPacks.find((p) => p.id === activePackId) || rankedPacks[0];
  const packsUnlocked = blendedFindings.length >= 2;

  const askSamEvidencePack = useMemo(
    () =>
      buildAskSamEvidencePack({
        stateCode: productStateCode,
        view,
        evidenceId: activeEvidenceId,
        roleId: selectedRole,
        spineStep,
        trustReviewed,
        pathPinned,
        askSamHint: roleProfile?.askSamHint || null,
        focuses: selectedFocuses,
        findings: blendedFindings,
        pack: activePack,
      }),
    [
      view,
      productStateCode,
      activeEvidenceId,
      selectedRole,
      spineStep,
      trustReviewed,
      pathPinned,
      roleProfile?.askSamHint,
      selectedFocuses,
      blendedFindings,
      activePack,
    ],
  );

  const pageExplain = useMemo(
    () =>
      resolvePageExplain({
        stateCode: productStateCode,
        view,
        evidenceRoomId: activeEvidenceId,
        lawInstrumentId: activeLawId,
        roleId: selectedRole,
        roleEmphasis: roleProfile?.briefEmphasis || null,
      }),
    [view, activeEvidenceId, activeLawId, selectedRole, roleProfile, productStateCode],
  );

  function toggleFocus(id) {
    setSelectedFocuses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function addFinding(id) {
    setBlendedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function removeFinding(id) {
    setBlendedIds((prev) => prev.filter((x) => x !== id));
  }

  function setWeight(key, value) {
    setWeights((prev) => ({ ...prev, [key]: Number(value) }));
  }

  function resetWeights() {
    setWeights(
      roleProfile?.initialState?.weights
        ? { ...DEFAULT_WEIGHTS, ...roleProfile.initialState.weights }
        : DEFAULT_WEIGHTS,
    );
  }

  function goSpineStep(step) {
    setSpineStep(step);
    setSpineVisited((prev) => {
      const next = new Set(prev);
      next.add(step);
      return next;
    });
  }

  function spineButtonClass(step) {
    const classes = [];
    if (spineStep === step) classes.push('spine-on');
    if (spineVisited.has(step)) classes.push('spine-visited');
    if (step === 'Trust' && !trustReviewed) classes.push('spine-amber');
    if (step === 'Trust' && trustReviewed) classes.push('spine-done');
    if (step === 'Action' && packsUnlocked) classes.push('spine-action-ready');
    return classes.join(' ');
  }

  const askSamRuntimeLabel = askSamStatus ? formatSamRuntimeLabel(askSamStatus) : null;

  return (
    <NavHistoryContext.Provider value={navHistory}>
    <div className={`app-shell layout-${viewportLayout}${selectionGate ? ' role-gate' : ''}`}>
      <header className="topbar">
        <DecisionProLogo onClick={openStateLanding} product={product} />
        <div className="topbar-right">
          <UiZoomControl />
          {productStateCode ? <div className="role-switcher product-switcher">
            <label className="sr-only" htmlFor="product-state-select">
              DecisionPro state product
            </label>
            <select
              id="product-state-select"
              value={productStateCode}
              onChange={(e) => switchProductState(e.target.value)}
              title="Switch DecisionPro state product"
            >
              <option value="KY">DecisionPro Kentucky</option>
              <option value="FL">DecisionPro Florida</option>
            </select>
          </div> : null}
          {selectedRole && roleProfile ? (
            <div className="role-switcher">
              <label className="sr-only" htmlFor="role-switch-select">
                Active role perspective
              </label>
              <select
                id="role-switch-select"
                value={view === 'role-selector' ? '__role-selector__' : selectedRole}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === '__role-selector__') {
                    openRoleSelector();
                    return;
                  }
                  selectRole(next);
                }}
                title="Switch role perspective (not permissions)"
              >
                <option value="__role-selector__">Role Selector Page</option>
                {listRoleProfiles().map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.shortLabel}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <TopbarGlossaryButton />
          {showChrome && walkthroughSteps.length ? (
            <button
              type="button"
              className={`explain-page-btn guide-page-btn${guideNeedsAttention ? ' guide-needs-attention' : ''}`}
              onClick={replayWalkthrough}
              title={`Start the guide for ${pageExplain.pageName}`}
              aria-label={guideNeedsAttention ? 'Guide this page — not yet viewed' : 'Guide this page'}
            >
              Guide
            </button>
          ) : null}
          <button
            type="button"
            className="explain-page-btn"
            onClick={() => {
              setFeedbackCategory(walkthroughOpen ? 'problem' : 'suggestion');
              setFeedbackOpen(true);
            }}
            title="Make a suggestion or report a problem"
          >
            Feedback
          </button>
          <button
            type="button"
            className="explain-page-btn explain-page-btn-full"
            onClick={() => setExplainOpen(true)}
            title={`Explain ${pageExplain.pageName}`}
          >
            <span className="explain-page-btn-label-full">Explain this Page</span>
            <span className="explain-page-btn-label-short" aria-hidden="true">Explain</span>
          </button>
        </div>
      </header>

      <GlossaryModal />
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        initialCategory={feedbackCategory}
        contextSnapshot={{
          roleId: selectedRole,
          view,
          activeEvidenceId,
          activeLawId,
          activePackId,
          evidenceObjectId,
          walkthrough: walkthroughOpen
            ? {
                open: true,
                stepId: walkthroughSteps[walkthroughIndexRef.current]?.id ?? null,
                stepTitle: walkthroughSteps[walkthroughIndexRef.current]?.title ?? null,
                index: walkthroughIndexRef.current,
              }
            : null,
        }}
      />
      <ExplainThisPage
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        explain={pageExplain}
      />

      <CalloutWalkthrough
        open={walkthroughOpen && !showMeOpen}
        steps={walkthroughSteps}
        mode="tour"
        initialIndex={walkthroughResumeIndex}
        onClose={() => closeWalkthrough({ markSeen: true })}
        onSkipAll={skipAllWalkthroughs}
        onComplete={() => closeWalkthrough({ markSeen: true })}
        onContinueNextPage={nextWalkthroughRoute ? continueWalkthroughOnNextPage : null}
        onStepChange={showWalkthroughStep}
        onShowExample={startGuideExample}
      />

      <CalloutWalkthrough
        open={showMeOpen}
        steps={showMeSteps}
        mode="show-me"
        onClose={() => exitShowMe({ restoreSnapshot: true })}
        onComplete={completeShowMe}
        onStepChange={applyShowMeStep}
        onTryExample={tryGuideExample}
        onReturnToGuide={returnGuideExample}
      />

      <div className="body-row">
        {showChrome && compactLayout && !navCollapsed ? (
          <button
            type="button"
            className="nav-drawer-backdrop"
            aria-label="Close navigation"
            onClick={() => setNavCollapsed(true)}
          />
        ) : null}
        {showChrome ? (
        <nav
          ref={leftNavRef}
          className={[
            'left-nav',
            askSamOpen ? 'sam-open' : '',
            navCollapsed ? 'collapsed' : '',
            compactLayout ? (navCollapsed ? 'is-drawer-closed' : 'is-drawer-open') : '',
          ].filter(Boolean).join(' ')}
          aria-label="Primary"
          aria-hidden={compactLayout && navCollapsed ? true : undefined}
          style={compactLayout ? undefined : { width: navCollapsed ? 44 : navWidth }}
        >
          <button
            type="button"
            className="nav-collapse-btn"
            onClick={toggleNavCollapse}
            aria-expanded={!navCollapsed}
            aria-controls="left-nav-body"
            title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <span aria-hidden="true">{navCollapsed ? '>>' : '<<'}</span>
            <span className="sr-only">{navCollapsed ? 'Expand navigation' : 'Collapse navigation'}</span>
          </button>

          <div id="left-nav-body" className="left-nav-body" hidden={navCollapsed}>
            <div className="left-nav-scroll">
              {roleProfile ? (
                <div className="nav-section">
                  <button
                    type="button"
                    className={`nav-primary ${view === 'role-home' ? 'active' : ''}`}
                    onClick={() => navigate({ view: 'role-home', evidenceObjectId: null })}
                    data-walkthrough-target="nav-role-home"
                  >
                    {roleProfile.shortLabel} home
                  </button>
                </div>
              ) : null}

              <div className="nav-section">
                <button
                  type="button"
                  className={`nav-primary ${operationalActive ? 'active' : ''}`}
                  onClick={() => navigate({ view: 'operational', evidenceObjectId: null })}
                  data-walkthrough-target="nav-operational-intelligence"
                >
                  Operational intelligence
                </button>
              </div>

              <div className="nav-section">
                <button
                  type="button"
                  className={`nav-primary ${sourcesActive ? 'active' : ''}`}
                  onClick={() => openAuthoritativeSources(null)}
                  data-walkthrough-target="nav-authoritative-sources"
                >
                  Authoritative sources
                </button>
              </div>

              <div className="nav-section">
                <button
                  type="button"
                  className={`nav-primary ${evidenceActive ? 'active' : ''}`}
                  data-walkthrough-target="nav-evidence-index"
                  onClick={() => {
                    navigate({
                      view: 'evidence',
                      activeEvidenceId: null,
                      evidenceObjectId: null,
                      activeLawId: null,
                    });
                  }}
                >
                  Evidence Rooms
                </button>
                <ul className="nav-sublist">
                  {orderedRooms.map((room) => (
                    <li key={room.id}>
                      <button
                        type="button"
                        className={`nav-sub ${activeEvidenceId === room.id && evidenceActive ? 'active' : ''}`}
                        onClick={() => openEvidenceRoom(room.id)}
                        data-walkthrough-target={`nav-room-${room.id}`}
                      >
                        {room.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="nav-section">
                <button
                  type="button"
                  className={`nav-primary ${blenderActive ? 'active' : ''}`}
                  onClick={openBlender}
                  data-walkthrough-target="nav-blender"
                >
                  Consideration Blender
                </button>
                <ul className="nav-sublist">
                  <li>
                    <button
                      type="button"
                      className={`nav-sub ${view === 'blender' ? 'active' : ''}`}
                      onClick={() => navigate({ view: 'blender', evidenceObjectId: null })}
                    >
                      Blend & weigh
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`nav-sub ${view === 'pack' ? 'active' : ''}`}
                      onClick={() => navigate({ view: 'pack', evidenceObjectId: null })}
                      disabled={!packsUnlocked}
                      data-walkthrough-target="nav-pack"
                    >
                      Win-Win-Win Pack
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`nav-sub ${view === 'brief' ? 'active' : ''}`}
                      onClick={() => navigate({ view: 'brief', evidenceObjectId: null })}
                      disabled={!packsUnlocked}
                      data-walkthrough-target="nav-brief"
                    >
                      Consideration Brief
                    </button>
                  </li>
                </ul>
              </div>

              <div className="nav-section">
                <button
                  type="button"
                  className={`nav-primary ${legislationActive ? 'active' : ''}`}
                  onClick={() => navigate({ view: 'legislation', activeLawId: null, evidenceObjectId: null })}
                  data-walkthrough-target="nav-legislation"
                >
                  Legislative Analysis
                </button>
                <ul className="nav-sublist">
                  <li>
                    <button
                      type="button"
                      className={`nav-sub ${view === 'legislation' ? 'active' : ''}`}
                      onClick={() => navigate({ view: 'legislation', activeLawId: null, evidenceObjectId: null })}
                    >
                      Law ↔ blender
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            {askSamOpen ? (
              <div
                className="nav-split-h"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize Ask Sam panel"
                onPointerDown={startSamHeightDrag}
              />
            ) : null}

            <div
              className="nav-section ask-sam-nav"
              style={
                askSamOpen
                  ? { flex: '1 1 auto', minHeight: samPanelHeight }
                  : undefined
              }
            >
              <button
                type="button"
                className={`nav-primary ask-sam-nav-btn ${askSamOpen ? 'active' : ''}`}
                onClick={toggleAskSam}
                aria-expanded={askSamOpen}
                aria-controls="ask-sam-dock"
                data-walkthrough-target="nav-ask-sam"
              >
                <span className="ask-sam-nav-btn-label">Ask Sam</span>
                {askSamRuntimeLabel ? (
                  <span className="ask-sam-runtime" title={askSamRuntimeLabel}>
                    {askSamRuntimeLabel}
                  </span>
                ) : null}
              </button>
              <div id="ask-sam-dock" className={`ask-sam-nav-panel ${askSamOpen ? 'open' : ''}`}>
                <AskSamDock
                  open={askSamOpen}
                  variant="nav"
                  guidedPrompt={showMeOpen ? guidedAskSamPrompt : null}
                  guidedReply={showMeOpen ? guidedAskSamReply : null}
                  onStatusChange={onAskSamStatusChange}
                  context={{
                    stateCode: productStateCode,
                    view,
                    evidenceId: activeEvidenceId,
                    focuses: selectedFocuses,
                    findings: blendedFindings,
                    pack: activePack,
                    spineStep,
                    trustReviewed,
                    pathPinned,
                    roleId: selectedRole,
                    askSamHint: roleProfile?.askSamHint || null,
                    evidencePack: askSamEvidencePack,
                  }}
                />
              </div>
            </div>
          </div>

          {!navCollapsed ? (
            <div
              className="nav-split-v"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize navigation width"
              onPointerDown={startNavWidthDrag}
            />
          ) : null}
        </nav>
        ) : null}

        <div className="content-column" ref={contentColumnRef}>
          {view === 'state-selector' && (
            <StateLanding onSelectState={selectProductState} onOpenComparison={openFloridaComparison} />
          )}

          {view === 'fl-comparison' && (
            <FloridaComparisonPage
              onBack={openStateLanding}
              onOpenFlorida={() => selectProductState('FL')}
              onOpenKentucky={() => selectProductState('KY')}
            />
          )}

          {view === 'role-selector' && (
            <RoleSelector onSelectRole={selectRole} product={product} />
          )}

          {view === 'role-home' && (isFlorida ? (
            <FloridaRoleHome
              roleProfile={roleProfile}
              onOpenOperational={() => navigate({ view: 'operational', evidenceObjectId: null })}
              onOpenRoom={openEvidenceRoom}
              onBrowseSources={openAuthoritativeSources}
            />
          ) : (
            <RoleHome
              roleId={selectedRole}
              onAction={handleRoleHomeAction}
              onOpenRoom={openEvidenceRoom}
              onShowMe={startShowMe}
              onOpenSmartTile={openRoleHomeSmartTile}
              onBrowseSources={openAuthoritativeSources}
              highlightedPriorityId={highlightPriorityId}
            />
          ))}

          {view === 'operational' && (
            <OperationalIntelligence
              stateCode={productStateCode}
              onBrowseSources={openAuthoritativeSources}
            />
          )}

          {view === 'blender' && (isFlorida ? (
            <FloridaDecisionSurface
              kind="blender"
              onOpenOperational={() => navigate({ view: 'operational', evidenceObjectId: null })}
              onOpenRoom={openEvidenceRoom}
            />
          ) : (
            <main className="main">
              <PageTitleWithBack className="page-title-with-back-tight">
                <div data-walkthrough-target="blender-title">
                  <p className="sap-alp-eyebrow">Consideration Blender</p>
                  <h2>Blend & weigh</h2>
                  <p className="hint">
                    Select focus tabs, send findings into the blender, and walk the question spine.
                    {roleProfile ? (
                      <>
                        {' '}
                        <span className="role-perspective-hint">
                          Role defaults emphasize {roleProfile.shortLabel.toLowerCase()} priorities
                          (perspective only).
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
              </PageTitleWithBack>
              <section
                className="focus-tabs"
                aria-label="Focus tabs"
                data-walkthrough-target="blender-focus-tabs"
              >
                <h2>Focus tabs — select any to scan</h2>
                <div className="tab-row">
                  {FOCUS_TABS.map((tab) => {
                    const on = selectedFocuses.includes(tab.id);
                    return (
                      <button
                        key={tab.id}
                        className={`focus-tab ${on ? 'on' : ''}`}
                        style={{ '--tab': tab.color }}
                        onClick={() => toggleFocus(tab.id)}
                        aria-pressed={on}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section
                className="spine"
                aria-label="Question spine"
                data-walkthrough-target="blender-spine"
              >
                <div className="spine-buttons">
                  {SPINE_STEPS.map((step) => (
                    <button
                      key={step}
                      type="button"
                      className={spineButtonClass(step)}
                      onClick={() => goSpineStep(step)}
                    >
                      {spineVisited.has(step) && step !== spineStep ? (
                        <span className="spine-check" aria-hidden="true">
                          ✓
                        </span>
                      ) : null}
                      {step}
                    </button>
                  ))}
                </div>
                <p className="spine-cue">{SPINE_CUES[spineStep] || 'Question spine'}</p>
              </section>

              <div className="blender-grid">
                <aside className="rail">
                  <h3>Inputs ready to blend</h3>
                  <p className="hint">Findings from selected focus tabs. Add into the blender.</p>
                  <ul className="finding-list" data-walkthrough-target="blender-findings">
                    {availableFindings.map((f) => {
                      const inBlend = blendedIds.includes(f.id);
                      const weight = findingDisplayWeight(f);
                      return (
                        <li key={f.id} className={`finding-card freshness-${slug(f.freshness)}`}>
                          <div className="finding-title">{f.title}</div>
                          <div className="finding-meta">
                            <span>{f.magnitude}</span>
                            <span>{f.freshness}</span>
                            <span>Weight {(weight * 100).toFixed(0)}%</span>
                          </div>
                          <div className="finding-note">{f.sourceIncentiveNote}</div>
                          {(f.primarySources || []).length ? (
                            <ul className="finding-sources">
                              {f.primarySources.slice(0, 2).map((src) => (
                                <li key={src.id || src.href}>
                                  <a href={src.href} target="_blank" rel="noopener noreferrer">
                                    {src.label}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          <button onClick={() => (inBlend ? removeFinding(f.id) : addFinding(f.id))}>
                            {inBlend ? 'Remove from blender' : 'Add to blender'}
                          </button>
                        </li>
                      );
                    })}
                    {!availableFindings.length && (
                      <li className="empty">Select a focus tab to see findings.</li>
                    )}
                  </ul>
                </aside>

                <section className="blender-center">
                  <h3>Consideration Blender · {spineStep}</h3>
                  <SpineStage
                    step={spineStep}
                    blendedFindings={blendedFindings}
                    radar={radar}
                    weights={weights}
                    normalizedWeights={normalizedWeights}
                    onSetWeight={setWeight}
                    onResetWeights={resetWeights}
                    rankedPacks={rankedPacks}
                    packsUnlocked={packsUnlocked}
                    focuses={selectedFocuses}
                    activePack={activePack}
                    brief={brief}
                    trustReviewed={trustReviewed}
                    onTrustReviewed={setTrustReviewed}
                    pathPinned={pathPinned}
                    onPinPath={() => setPathPinned(true)}
                    onOpenLegislation={() => navigate({ view: 'legislation', activeLawId: null })}
                    onOpenLaw={openLawInstrument}
                    onOpenEvidence={() => {
                      navigate({
                        view: 'evidence',
                        activeEvidenceId: null,
                        evidenceObjectId: null,
                      });
                    }}
                    onOpenPack={(id) => {
                      navigate({ view: 'pack', activePackId: id, evidenceObjectId: null });
                    }}
                    onOpenBrief={() => navigate({ view: 'brief', evidenceObjectId: null })}
                    onGotoStep={goSpineStep}
                  />
                </section>

                <aside className="rail packs-rail">
                  <h3>Win-Win-Win suggestions</h3>
                  {!packsUnlocked ? (
                    <div className="locked">
                      <p>Blend 2+ findings to unlock innovative options to examine.</p>
                      <p className="hint">Not prescriptions — examination candidates only.</p>
                    </div>
                  ) : (
                    <ul className="pack-list">
                      {rankedPacks.map((pack) => (
                        <li key={pack.id}>
                          <button
                            className="pack-card"
                            onClick={() => {
                              navigate({ view: 'pack', activePackId: pack.id, evidenceObjectId: null });
                            }}
                          >
                            <strong>{pack.title}</strong>
                            <span>
                              Score {(pack.score * 100).toFixed(0)} · {pack.evidenceLevel}
                            </span>
                            <span className="tags">{pack.tags.join(' · ')}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              </div>
            </main>
          ))}

          {view === 'pack' && (isFlorida ? (
            <FloridaDecisionSurface
              kind="pack"
              onOpenOperational={() => navigate({ view: 'operational', evidenceObjectId: null })}
              onOpenRoom={openEvidenceRoom}
            />
          ) : activePack ? (
            <main className="main pack-view">
              <PageTitleWithBack>
                <div data-walkthrough-target="pack-title">
                  <p className="disclaimer">Options to examine — not a prescription.</p>
                  <h2>{activePack.title}</h2>
                </div>
              </PageTitleWithBack>
              <div className="win-grid" data-walkthrough-target="pack-wins">
                <article>
                  <h3>Budget win</h3>
                  <p>{activePack.budgetWin}</p>
                </article>
                <article>
                  <h3>Constituent care win</h3>
                  <p>{activePack.careWin}</p>
                </article>
                <article>
                  <h3>Political viability win</h3>
                  <p>{activePack.politicalWin}</p>
                </article>
              </div>
              <section className="pack-competition" aria-label="Competition charts">
                <h3>Competition view</h3>
                <p className="hint">
                  Click a chart to enlarge it — read what it shows, how to use it, and what the weight
                  sliders change. Radar overlays this pack on the current blend profile.
                </p>
                <ChartPair
                  findings={blendedFindings}
                  radar={radar}
                  packs={[activePack]}
                  weights={weights}
                  normalizedWeights={normalizedWeights}
                  onSetWeight={setWeight}
                  onResetWeights={resetWeights}
                />
              </section>
              <dl className="pack-details" data-walkthrough-target="pack-details">
                <div>
                  <dt>Who may gain</dt>
                  <dd>{activePack.whoGains}</dd>
                </div>
                <div>
                  <dt>Who may bear cost</dt>
                  <dd>{activePack.whoMayBearCost}</dd>
                </div>
                <div>
                  <dt>Time horizon</dt>
                  <dd>{activePack.timeHorizon}</dd>
                </div>
                <div>
                  <dt>Legal / contracting levers</dt>
                  <dd>{activePack.levers.join('; ')}</dd>
                </div>
                <div>
                  <dt>Why it might fail</dt>
                  <dd>{activePack.failureModes.join('; ')}</dd>
                </div>
                <div>
                  <dt>Trust caveats</dt>
                  <dd>{activePack.trustCaveats}</dd>
                </div>
              </dl>
              <div className="actions">
                <button onClick={() => navigate({ view: 'brief', evidenceObjectId: null })}>
                  Add to Consideration Brief
                </button>
                <button onClick={goBack}>Back</button>
              </div>
            </main>
          ) : null)}

          {view === 'brief' && (isFlorida ? (
            <FloridaDecisionSurface
              kind="brief"
              onOpenOperational={() => navigate({ view: 'operational', evidenceObjectId: null })}
              onOpenRoom={openEvidenceRoom}
            />
          ) : (
            <ConsiderationBrief
              brief={brief}
              findings={blendedFindings}
              weights={normalizedWeights}
              onBack={goBack}
              onOpenLaw={openLawInstrument}
              roleEmphasis={roleProfile?.briefEmphasis || null}
            />
          ))}

          {view === 'evidence' && activeEvidenceId === 'funding-resilience' && (
            <FundingResilienceRoom
              stateCode={productStateCode}
              onOpenCatalogueSource={openAuthoritativeSources}
              guidedItemType={showMeOpen ? guidedItemType : null}
              guidedLeadTitleContains={showMeOpen ? guidedLeadTitleContains : null}
            />
          )}

          {view === 'evidence' && activeEvidenceId !== 'funding-resilience' && (isFlorida ? (
            <FloridaEvidenceWorkspace activeRoomId={activeEvidenceId} onOpenRoom={openEvidenceRoom} />
          ) : (
            <main className="main evidence-view">
              {activeEvidenceId ? (
                <EvidenceRoomScreen
                  roomId={activeEvidenceId}
                  onOpenLaw={openLawInstrument}
                  selectedObjectId={evidenceObjectId}
                  onOpenObject={(row) => {
                    if (showMeOpen) {
                      setEvidenceObjectId(row.id);
                      return;
                    }
                    navigate({ evidenceObjectId: row.id });
                  }}
                  onClearObject={() => {
                    if (showMeOpen) {
                      setEvidenceObjectId(null);
                      return;
                    }
                    goBack();
                  }}
                  guidedFilters={showMeOpen ? guidedFilters : roomEntryFilters}
                  guidedViewMode={showMeOpen ? guidedViewMode : roomEntryViewMode}
                  guidedObjectFacet={showMeOpen ? guidedObjectFacet : null}
                  guidedLeadItemId={showMeOpen ? guidedLeadItemId : null}
                  onOpenCatalogueSource={openAuthoritativeSources}
                  tileInfoFocus={tileInfoFocus}
                />
              ) : (
                <EvidenceRoomsIndex
                  rooms={orderedRooms}
                  onOpen={openEvidenceRoom}
                  roleLabel={roleProfile?.label || null}
                  roleEmphasis={roleProfile?.dataEmphasis?.[0] || null}
                />
              )}
            </main>
          ))}

          {view === 'sources' && (isFlorida ? (
            <FloridaSourcesPanel />
          ) : (
            <main className="main sources-view">
              <PageTitleWithBack>
                <h2>Authoritative sources</h2>
              </PageTitleWithBack>
              <AuthoritativeSourcesPanel
                initialFromSysId={sourcesFocusId}
                initialTab={sourcesFocusTab}
                focusNonce={sourcesFocusNonce}
              />
            </main>
          ))}

          {view === 'legislation' && (isFlorida ? (
            <FloridaDecisionSurface
              kind="legislation"
              onOpenOperational={() => navigate({ view: 'operational', evidenceObjectId: null })}
              onOpenRoom={openEvidenceRoom}
            />
          ) : (
            <LegislativeAnalysis
              focuses={selectedFocuses}
              findings={blendedFindings}
              pack={activePack}
              onOpenBlender={openBlender}
              onOpenLaw={openLawInstrument}
            />
          ))}

          {view === 'law-object' && !isFlorida && (
            <LegislationObjectPage
              instrumentId={activeLawId}
              focuses={selectedFocuses}
              pack={activePack}
              onClose={goBack}
              onOpenLegislation={() => navigate({ view: 'legislation', activeLawId: null })}
            />
          )}

          {!['state-selector', 'fl-comparison'].includes(view) ? <footer className="footer">
            <span className="footer-copy">
              <GlossaryText text="Aggregate / de-identified views. No PHI. No person-level identifiers." />
              {roleProfile
                ? ` · Perspective: ${roleProfile.shortLabel} (not an access-control boundary).`
                : ''}
              {` · ${product.brand} · A product of XenoDroid Inc.`}
            </span>
            <div className="banner" role="status">
              {product.evidenceBadge}
            </div>
          </footer> : null}
        </div>
      </div>
    </div>
    </NavHistoryContext.Provider>
  );
}

function slug(value) {
  return String(value).toLowerCase().replace(/\s+/g, '-');
}
