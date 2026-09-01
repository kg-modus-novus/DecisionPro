/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StateLanding } from '../components/StateLanding.jsx';

afterEach(() => {
  document.body.innerHTML = '';
});

function click(element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
}

describe('StateLanding funding-resilience entry links', () => {
  it('requests the funding-resilience room as an entry intent, not a bare state selection', () => {
    const onSelectState = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<StateLanding onSelectState={onSelectState} />));

    const links = [...host.querySelectorAll('a')];
    const openKy = links.find((a) => a.textContent.includes('Open in Kentucky'));
    const openFl = links.find((a) => a.textContent.includes('Open in Florida'));
    expect(openKy).toBeTruthy();
    expect(openFl).toBeTruthy();

    click(openKy);
    expect(onSelectState).toHaveBeenLastCalledWith('KY', { entryRoomId: 'funding-resilience' });

    click(openFl);
    expect(onSelectState).toHaveBeenLastCalledWith('FL', { entryRoomId: 'funding-resilience' });

    // The plain state-product cards must NOT carry the room intent — only
    // the dedicated Funding & Resilience tile does.
    const openKentuckyCard = links.find((a) => a.textContent.includes('Open Kentucky'));
    expect(openKentuckyCard).toBeTruthy();
    onSelectState.mockClear();
    click(openKentuckyCard);
    expect(onSelectState).toHaveBeenLastCalledWith('KY');

    act(() => root.unmount());
  });
});
