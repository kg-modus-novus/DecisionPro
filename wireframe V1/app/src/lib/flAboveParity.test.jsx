/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FloridaDecisionWorkspace, FloridaEvidenceExplorer } from '../components/FloridaAboveParity.jsx';
import { FL_EVIDENCE_ROOMS } from '../components/FloridaWorkspace.jsx';
import { FL_OPERATIONAL_SOURCES } from '../data/alp/flOperationalSources.js';

afterEach(() => { document.body.innerHTML = ''; });

function mount(node) {
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host); act(() => root.render(node));
  return { host, unmount: () => act(() => root.unmount()) };
}

function click(element) { act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true }))); }

describe('DPro-FL above-parity workspaces', () => {
  it('provides analysis, source-native parity and integrated reporting in an Evidence Room', () => {
    const room = FL_EVIDENCE_ROOMS.find((item) => item.id === 'fl-facilities');
    const roomSources = FL_OPERATIONAL_SOURCES.sources.filter((item) => room.sourceIds.includes(item.fromSysId));
    const roomMetrics = FL_OPERATIONAL_SOURCES.metrics.filter((item) => room.sourceIds.includes(item.fromSysId));
    const { host, unmount } = mount(<FloridaEvidenceExplorer room={room} roomSources={roomSources} roomMetrics={roomMetrics} roomGaps={[]} />);
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(host.textContent).toMatch(/County capacity comparison/);
    expect(host.querySelectorAll('.fl-analytics-table tbody tr').length).toBeGreaterThan(50);
    click([...host.querySelectorAll('[role="tab"]')].find((item) => item.textContent.includes('Source-native')));
    expect(host.querySelector('iframe[title*="Florida AHCA"]')).toBeTruthy();
    expect(host.textContent).toMatch(/preserves publisher-provided filters, comparisons, downloads and detail/i);
    click([...host.querySelectorAll('[role="tab"]')].find((item) => item.textContent.includes('Integrated report')));
    expect(host.textContent).toMatch(/decision packet/);
    expect(host.textContent).toMatch(/Recommended reviewer sequence/);
    unmount();
  });

  it('adds weighted portfolio ranking and an editable realized-value control', () => {
    const { host, unmount } = mount(<FloridaDecisionWorkspace kind="blender" onOpenOperational={() => {}} onOpenRoom={() => {}} />);
    expect(host.querySelectorAll('.fl-weight-grid input[type="range"]')).toHaveLength(4);
    expect(host.querySelectorAll('.fl-ranked-goals article')).toHaveLength(6);
    expect(host.querySelectorAll('.fl-action-tracker tbody tr').length).toBeGreaterThanOrEqual(7);
    expect(host.textContent).toMatch(/Modeled benefit remains separate from reviewer-entered realized value/i);
    expect(host.querySelector('input[aria-label*="realized value"]')).toBeTruthy();
    unmount();
  });

  it('renders differentiated pack, brief and legislative reporting surfaces', () => {
    for (const [kind, expected] of [['pack', /People/], ['brief', /Executive decision brief/], ['legislation', /Oversight question/]]) {
      const { host, unmount } = mount(<FloridaDecisionWorkspace kind={kind} onOpenOperational={() => {}} onOpenRoom={() => {}} />);
      expect(host.textContent).toMatch(expected);
      expect(host.textContent).toMatch(/Florida action and benefit tracker/);
      unmount();
    }
  });
});
