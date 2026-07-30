/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AnalyticalListPage } from '../components/alp/AnalyticalListPage.jsx';
import { ROOM_CONFIGS } from '../data/alp/roomConfigs.js';
import { resolveLeadRow } from '../data/showMeJourneys.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(node) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(node);
  });
  return {
    host,
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe('Show Me analytical surfaces', () => {
  it('applies guided filters, highlights lead item, and walks object facets', () => {
    const filters = { region: 'east', population: 'disabled' };
    const lead = resolveLeadRow('county', filters);
    expect(lead).toBeTruthy();

    const { host, root, unmount } = mount(
      <AnalyticalListPage
        config={ROOM_CONFIGS.county}
        guidedFilters={filters}
        guidedViewMode="hybrid"
        guidedLeadItemId={lead.id}
        onOpenObject={() => {}}
      />,
    );

    expect(host.querySelector('[data-walkthrough-target="alp-visual-filters"]')).toBeTruthy();
    expect(host.querySelector('[data-walkthrough-target="alp-content-chart"]')).toBeTruthy();
    expect(host.querySelector('[data-walkthrough-target="alp-detail-list"]')).toBeTruthy();
    expect(host.querySelector('[data-walkthrough-target="alp-lead-item"]')).toBeTruthy();
    expect(host.querySelector('.is-lead-item')).toBeTruthy();

    act(() => {
      root.render(
        <AnalyticalListPage
          config={ROOM_CONFIGS.county}
          guidedFilters={filters}
          guidedViewMode="hybrid"
          guidedLeadItemId={lead.id}
          guidedObjectFacet="identification"
          selectedObjectId={lead.id}
          onOpenObject={() => {}}
          onClearObject={() => {}}
        />,
      );
    });

    expect(host.querySelector('[data-walkthrough-target="object-facet-overview"]')).toBeTruthy();
    expect(host.querySelector('[data-walkthrough-target="object-facet-identification"]')).toBeTruthy();
    expect(host.querySelector('[data-walkthrough-target="object-facet-related"]')).toBeTruthy();
    expect(host.querySelector('[data-walkthrough-target="object-facet-legislation"]')).toBeTruthy();
    expect(host.querySelector('[data-walkthrough-target="object-facet-options"]')).toBeTruthy();
    expect(
      host.querySelector('[data-walkthrough-target="object-facet-identification"].on'),
    ).toBeTruthy();

    unmount();
  });
});
