/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { VisualFilterBar, filterNodeTip } from '../components/alp/VisualFilterBar.jsx';

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
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

const config = {
  id: 'utilization',
  filters: [
    {
      key: 'region',
      label: 'Region',
      chart: 'bar',
      options: [
        { id: 'urban', label: 'urban' },
        { id: 'rural', label: 'rural' },
      ],
    },
    {
      key: 'period',
      label: 'Period',
      chart: 'line',
      options: [
        { id: 'y2017', label: '2017', sort: 1 },
        { id: 'latest', label: 'Latest', sort: 2 },
      ],
    },
    {
      key: 'measureType',
      label: 'Measure type',
      chart: 'donut',
      options: [
        { id: 'access', label: 'Access' },
        { id: 'utilization', label: 'Utilization' },
      ],
    },
  ],
};

describe('filterNodeTip', () => {
  it('formats label and value', () => {
    expect(filterNodeTip('urban', 13)).toBe('urban: 13');
    expect(filterNodeTip('Access', 20)).toBe('Access: 20');
    expect(filterNodeTip('Latest', 0)).toBe('Latest: 0');
    expect(filterNodeTip('Enrollment', 1_400_000)).toBe('Enrollment: 1.4M');
  });
});

describe('visual filter node hover tips', () => {
  it('puts label+value tips on bar and donut nodes', () => {
    const { host, unmount } = mount(
      <VisualFilterBar
        config={config}
        filters={{}}
        seriesByFilter={{
          region: [
            { id: 'urban', value: 13 },
            { id: 'rural', value: 2 },
          ],
          period: [
            { id: 'y2017', value: 87 },
            { id: 'latest', value: 0 },
          ],
          measureType: [
            { id: 'access', value: 20 },
            { id: 'utilization', value: 4 },
          ],
        }}
        onFilter={() => {}}
      />,
    );

    const urban = host.querySelector('[data-filter-tip="urban: 13"]');
    expect(urban).toBeTruthy();
    expect(urban.getAttribute('title')).toBe('urban: 13');

    const accessPath = [...host.querySelectorAll('path')].find(
      (p) => p.getAttribute('aria-label') === 'Access: 20',
    );
    expect(accessPath).toBeTruthy();

    const latestPoint = [...host.querySelectorAll('[role="button"]')].find(
      (el) => el.getAttribute('aria-label') === 'Latest: 0',
    );
    expect(latestPoint).toBeTruthy();

    unmount();
  });
});
