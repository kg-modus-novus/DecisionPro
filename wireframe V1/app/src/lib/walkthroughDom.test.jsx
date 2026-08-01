/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CalloutWalkthrough, measurePlacement } from '../components/CalloutWalkthrough.jsx';
import { RoleHome } from '../components/RoleHome.jsx';
import { RoleSelector } from '../components/RoleSelector.jsx';
import { ROLE_IDS, getRoleProfile } from '../data/roleProfiles.js';

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

describe('RoleSelector DOM', () => {
  it('renders seven role tiles with I-buttons and demo framing', () => {
    const { host, unmount } = mount(<RoleSelector onSelectRole={() => {}} />);
    expect(host.textContent).toMatch(/Choose A Role/);
    expect(host.textContent).toMatch(/Role Selector is for the demo/i);
    expect(host.querySelectorAll('.role-tile')).toHaveLength(7);
    expect(host.querySelectorAll('.tile-info-btn')).toHaveLength(7);
    expect(host.querySelectorAll('.role-selector-info-tile')).toHaveLength(2);
    expect(host.textContent).toMatch(/Differences By Role/);
    expect(host.textContent).toMatch(/production system will enforce role-based authorization/i);
    expect(host.querySelector('[data-walkthrough-target="role-selector-cards"]')).toBeTruthy();
    expect(host.textContent).not.toMatch(/Data emphasis[\s\S]*Functionality/i);
    unmount();
  });
});

describe('RoleHome DOM', () => {
  it('gives every role home explicit high-contrast primary actions', () => {
    for (const roleId of ROLE_IDS) {
      const { host, unmount } = mount(
        <RoleHome roleId={roleId} onAction={() => {}} onOpenRoom={() => {}} />,
      );
      const profile = getRoleProfile(roleId);
      const home = host.querySelector('.role-home');
      const actions = host.querySelectorAll('.role-home-action');

      expect(home.style.getPropertyValue('--role-accent')).toBe(profile.accent);
      expect(actions).toHaveLength(profile.primaryActions.length);
      expect([...actions].every((button) => !button.classList.contains('sap-btn'))).toBe(true);
      unmount();
    }
  });

  it('renders three self-explanatory smart tiles per role and makes them actionable', () => {
    for (const roleId of ROLE_IDS) {
      const opened = [];
      const { host, unmount } = mount(
        <RoleHome
          roleId={roleId}
          onAction={() => {}}
          onOpenRoom={() => {}}
          onOpenSmartTile={(tile) => opened.push(tile.id)}
        />,
      );
      const tiles = host.querySelectorAll('.role-home-measures .role-home-measure');
      expect(tiles).toHaveLength(3);
      expect(host.textContent).toMatch(/Signals worth your attention/);
      expect([...tiles].every((tile) => tile.querySelector('.st-visual'))).toBe(true);
      expect([...tiles].every((tile) => tile.querySelector('.tile-info-btn'))).toBe(true);
      expect([...tiles].every((tile) => tile.getAttribute('data-smart-tile-id'))).toBeTruthy();
      act(() => {
        tiles[0].click();
      });
      expect(opened).toHaveLength(1);
      unmount();
    }
  });

  it('exposes Show Me on each priority with stable targets', () => {
    const launched = [];
    const { host, unmount } = mount(
      <RoleHome
        roleId="legislator"
        onAction={() => {}}
        onOpenRoom={() => {}}
        onShowMe={(priority) => launched.push(priority.id)}
        highlightedPriorityId="legislator-district-story"
      />,
    );
    const profile = getRoleProfile('legislator');
    const showMeButtons = host.querySelectorAll('.role-home-show-me');
    expect(showMeButtons).toHaveLength(3);
    for (const priority of profile.homePriorities) {
      expect(
        host.querySelector(`[data-walkthrough-target="role-home-priority-${priority.id}"]`),
      ).toBeTruthy();
    }
    expect(host.querySelector('.is-show-me-origin')).toBeTruthy();
    act(() => {
      showMeButtons[0].click();
    });
    expect(launched).toEqual([profile.homePriorities[0].id]);
    unmount();
  });
});

describe('CalloutWalkthrough DOM', () => {
  const steps = [
    {
      id: 'a',
      target: 'missing-target',
      title: 'Step A',
      purpose: 'Purpose A',
      data: 'Data A',
      functionality: 'Func A',
      example: 'Example A',
    },
    {
      id: 'b',
      target: 'missing-target',
      title: 'Step B',
      purpose: 'Purpose B',
      data: 'Data B',
      functionality: 'Func B',
      example: 'Example B',
    },
  ];

  it('keeps a tall walkthrough bubble inside a short viewport', () => {
    const previousWidth = window.innerWidth;
    const previousHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });

    const target = {
      scrollIntoView: () => {},
      getBoundingClientRect: () => ({
        left: 260,
        right: 640,
        top: 180,
        bottom: 300,
        width: 380,
        height: 120,
      }),
    };
    const bubble = {
      getBoundingClientRect: () => ({ height: 476 }),
    };

    const placement = measurePlacement(target, bubble);
    const top = Number.parseFloat(placement.bubbleStyle.top);
    expect(top).toBeGreaterThanOrEqual(12);
    expect(top + 476).toBeLessThanOrEqual(488);
    expect(placement.arrowStyle).toBeNull();

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: previousHeight });
  });

  it('shows progress, Next, Skip All, and centered fallback without a target', () => {
    const events = { skip: 0, complete: 0, close: 0, steps: [], showExample: [] };
    const { host, unmount } = mount(
      <CalloutWalkthrough
        open
        steps={steps}
        onSkipAll={() => {
          events.skip += 1;
        }}
        onComplete={() => {
          events.complete += 1;
        }}
        onClose={() => {
          events.close += 1;
        }}
        onStepChange={(step, index) => {
          events.steps.push([step.id, index]);
        }}
        onShowExample={(step, index) => {
          events.showExample.push([step.id, index]);
        }}
      />,
    );

    expect(events.steps).toEqual([['a', 0]]);
    expect(host.textContent).toMatch(/Step 1 of 2/);
    expect(host.querySelector('.walkthrough-example')?.textContent).toMatch(/Example A/);
    const exampleShowMe = host.querySelector('.walkthrough-example-show-me');
    expect(exampleShowMe).toBeTruthy();
    act(() => {
      exampleShowMe.click();
    });
    expect(events.showExample).toEqual([['a', 0]]);
    expect(host.querySelector('.walkthrough-bubble.is-center')).toBeTruthy();
    const skip = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Skip All');
    const next = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Next');
    expect(skip && next).toBeTruthy();

    act(() => {
      skip.click();
    });
    expect(events.skip).toBe(1);

    act(() => {
      next.click();
    });
    expect(events.steps.at(-1)).toEqual(['b', 1]);
    expect(host.textContent).toMatch(/Step 2 of 2/);
    const back = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Back');
    act(() => {
      back.click();
    });
    expect(events.steps.at(-1)).toEqual(['a', 0]);

    act(() => {
      [...host.querySelectorAll('button')].find((b) => b.textContent === 'Next').click();
    });
    const finish = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Finish');
    act(() => {
      finish.click();
    });
    expect(events.complete).toBe(1);
    unmount();
  });

  it('supports Show Me narrative mode with Exit Show Me and no nested example button', () => {
    const events = { close: 0, complete: 0, tryIt: 0, returnGuide: 0 };
    const showMeSteps = [
      {
        id: 's1',
        title: 'Guided step',
        narrative: 'Follow this controlled path.',
        example: 'Choose one visible filter.',
        target: 'missing-target',
        mode: 'show-me',
      },
      {
        id: 's2',
        title: 'Try it or return',
        narrative: 'Would you like to try this example yourself now, or return to the previous guided walk-through?',
        example: 'Choose an ending.',
        target: 'missing-target',
        mode: 'show-me',
        choice: true,
      },
    ];
    const { host, unmount } = mount(
      <CalloutWalkthrough
        open
        mode="show-me"
        steps={showMeSteps}
        onClose={() => {
          events.close += 1;
        }}
        onComplete={() => {
          events.complete += 1;
        }}
        onTryExample={() => {
          events.tryIt += 1;
        }}
        onReturnToGuide={() => {
          events.returnGuide += 1;
        }}
      />,
    );

    expect(host.querySelector('.walkthrough-layer.is-show-me')).toBeTruthy();
    expect(host.textContent).toMatch(/Show Me · Step 1 of 2/);
    expect(host.textContent).toMatch(/Follow this controlled path/);
    expect(host.querySelector('.walkthrough-example')?.textContent).toMatch(
      /Choose one visible filter/,
    );
    expect(host.querySelector('.walkthrough-example-show-me')).toBeNull();
    expect(host.textContent).not.toMatch(/Purpose\./);
    const exit = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Exit Show Me');
    expect(exit).toBeTruthy();

    act(() => {
      [...host.querySelectorAll('button')].find((b) => b.textContent === 'Next').click();
    });
    expect(host.textContent).toMatch(/Try it or return/);
    const tryIt = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Let me try it');
    const returnGuide = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Return to guide',
    );
    expect(tryIt && returnGuide).toBeTruthy();
    act(() => {
      tryIt.click();
    });
    expect(events.tryIt).toBe(1);
    act(() => {
      returnGuide.click();
    });
    expect(events.returnGuide).toBe(1);
    unmount();
  });

  it('resumes a guide at the provided initial index', () => {
    const events = { steps: [] };
    const { host, unmount } = mount(
      <CalloutWalkthrough
        open
        steps={steps}
        initialIndex={1}
        onStepChange={(step, index) => {
          events.steps.push([step.id, index]);
        }}
      />,
    );
    expect(events.steps).toEqual([['b', 1]]);
    expect(host.textContent).toMatch(/Step 2 of 2/);
    unmount();
  });
});
