/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEMO_PASSWORD,
  DEMO_USER_ID,
  DemoLoginGate,
} from '../components/DemoLoginGate.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
});

function renderGate(showAutoLogin) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(
    <DemoLoginGate showAutoLogin={showAutoLogin}>
      <div data-testid="dashboard">Dashboard loaded</div>
    </DemoLoginGate>,
  ));
  return host;
}

function setValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function click(element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

describe('DemoLoginGate', () => {
  it('defaults the requested credentials and exposes AutoLogin locally', () => {
    const host = renderGate(true);
    expect(host.querySelector('#demo-user-id').value).toBe(DEMO_USER_ID);
    expect(host.querySelector('#demo-password').value).toBe(DEMO_PASSWORD);
    expect([...host.querySelectorAll('button')].map((button) => button.textContent)).toContain('AutoLogin');
  });

  it('does not render AutoLogin in an online production configuration', () => {
    const host = renderGate(false);
    expect(host.textContent).not.toContain('AutoLogin');
  });

  it('accepts the demonstration credentials', () => {
    const host = renderGate(false);
    click(host.querySelector('.demo-login-submit'));
    expect(host.querySelector('[data-testid="dashboard"]')).toBeTruthy();
  });

  it('rejects incorrect credentials without opening the dashboard', () => {
    const host = renderGate(false);
    setValue(host.querySelector('#demo-password'), 'incorrect');
    click(host.querySelector('.demo-login-submit'));
    expect(host.querySelector('[role="alert"]').textContent).toMatch(/incorrect/i);
    expect(host.querySelector('[data-testid="dashboard"]')).toBeFalsy();
    setValue(host.querySelector('#demo-password'), DEMO_PASSWORD);
    expect(host.querySelector('[role="alert"]')).toBeFalsy();
  });

  it('opens the dashboard through local AutoLogin', () => {
    const host = renderGate(true);
    const button = [...host.querySelectorAll('button')].find((candidate) => candidate.textContent === 'AutoLogin');
    click(button);
    expect(host.querySelector('[data-testid="dashboard"]')).toBeTruthy();
  });
});
